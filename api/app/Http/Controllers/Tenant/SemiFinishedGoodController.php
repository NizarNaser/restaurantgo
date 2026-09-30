<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Models\RecipeLine;
use App\Models\SemiFinishedGood;
use App\Services\AuditService;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SemiFinishedGoodController extends Controller
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly InventoryService $inventory,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $goods = SemiFinishedGood::where('tenant_id', app('tenant')->id)
            ->when(! $request->boolean('include_inactive'), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->get();

        return response()->json($goods);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'unit' => ['required', Rule::in(['gram', 'piece'])],
        ]);

        $good = SemiFinishedGood::create(array_merge($data, ['tenant_id' => app('tenant')->id]));
        $this->audit->log('semi_finished_good.created', $good);

        return response()->json($good, 201);
    }

    public function update(Request $request, SemiFinishedGood $semiFinishedGood): JsonResponse
    {
        $this->authorizeTenant($semiFinishedGood);

        $data = $request->validate([
            'name'      => ['sometimes', 'string', 'max:255'],
            'unit'      => ['sometimes', Rule::in(['gram', 'piece'])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $semiFinishedGood->update($data);
        $this->audit->log('semi_finished_good.updated', $semiFinishedGood, $data);

        return response()->json($semiFinishedGood);
    }

    public function destroy(SemiFinishedGood $semiFinishedGood): JsonResponse
    {
        $this->authorizeTenant($semiFinishedGood);

        $this->audit->log('semi_finished_good.deleted', $semiFinishedGood);
        $semiFinishedGood->delete();

        return response()->json(['message' => 'Semi-finished good deleted.']);
    }

    /** This good's own production recipe (which raw ingredients make a batch of it). */
    public function showRecipe(SemiFinishedGood $semiFinishedGood): JsonResponse
    {
        $this->authorizeTenant($semiFinishedGood);

        return response()->json(
            $semiFinishedGood->ownRecipeLines()->with('componentable')->orderBy('sort_order')->get()
        );
    }

    public function syncRecipe(Request $request, SemiFinishedGood $semiFinishedGood): JsonResponse
    {
        $this->authorizeTenant($semiFinishedGood);

        $data = $request->validate([
            'lines'                        => ['present', 'array'],
            'lines.*.componentable_type'   => ['required', Rule::in(['ingredient', 'semi_finished_good'])],
            'lines.*.componentable_id'     => ['required', 'integer'],
            'lines.*.gross_quantity'       => ['required', 'numeric', 'gt:0'],
            'lines.*.net_quantity'         => ['nullable', 'numeric', 'gt:0'],
        ]);

        DB::transaction(function () use ($semiFinishedGood, $data) {
            $semiFinishedGood->ownRecipeLines()->delete();

            foreach ($data['lines'] as $index => $line) {
                $type = $line['componentable_type'] === 'ingredient' ? Ingredient::class : SemiFinishedGood::class;

                $componentable = $type::where('tenant_id', app('tenant')->id)->findOrFail($line['componentable_id']);
                abort_if(
                    $type === SemiFinishedGood::class && $componentable->id === $semiFinishedGood->id,
                    422,
                    'A semi-finished good cannot use itself as a component.'
                );

                RecipeLine::create([
                    'recipeable_type'    => SemiFinishedGood::class,
                    'recipeable_id'      => $semiFinishedGood->id,
                    'componentable_type' => $type,
                    'componentable_id'   => $componentable->id,
                    'gross_quantity'     => $line['gross_quantity'],
                    'net_quantity'       => $line['net_quantity'] ?? null,
                    'sort_order'         => $index,
                ]);
            }
        });

        $this->audit->log('semi_finished_good.recipe_updated', $semiFinishedGood, ['lines' => count($data['lines'])]);

        return response()->json($semiFinishedGood->ownRecipeLines()->with('componentable')->orderBy('sort_order')->get());
    }

    /** Produces a batch: consumes the recipe's raw ingredients, adds to this good's own stock. */
    public function produce(Request $request, SemiFinishedGood $semiFinishedGood): JsonResponse
    {
        $this->authorizeTenant($semiFinishedGood);

        $data = $request->validate([
            'quantity' => ['required', 'numeric', 'gt:0'],
            'notes'    => ['nullable', 'string', 'max:1000'],
        ]);

        $record = $this->inventory->produceSemiFinishedGood(
            $semiFinishedGood,
            (float) $data['quantity'],
            $request->user(),
            $data['notes'] ?? null,
        );

        $this->audit->log('semi_finished_good.produced', $semiFinishedGood, ['quantity' => $data['quantity']]);

        return response()->json(['good' => $semiFinishedGood->fresh(), 'production_record' => $record], 201);
    }

    private function authorizeTenant(SemiFinishedGood $good): void
    {
        abort_if((int) $good->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
