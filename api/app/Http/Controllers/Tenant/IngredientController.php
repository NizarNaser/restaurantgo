<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Services\AuditService;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class IngredientController extends Controller
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly InventoryService $inventory,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $ingredients = Ingredient::where('tenant_id', app('tenant')->id)
            ->when(! $request->boolean('include_inactive'), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->get();

        return response()->json($ingredients);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'unit'          => ['required', Rule::in(['gram', 'piece'])],
            'unit_price'    => ['nullable', 'numeric', 'min:0'],
            'current_stock' => ['nullable', 'numeric'],
            'entry_date'    => ['nullable', 'date'],
        ]);

        $ingredient = Ingredient::create([
            'tenant_id'   => app('tenant')->id,
            'name'        => $data['name'],
            'unit'        => $data['unit'],
            'unit_price'  => $data['unit_price'] ?? null,
        ]);

        // An initial quantity is recorded as a real purchase movement (not a
        // silent starting balance) so the ledger always explains every unit.
        if (! empty($data['current_stock'])) {
            $this->inventory->recordPurchase(
                Ingredient::class,
                $ingredient->id,
                (float) $data['current_stock'],
                $data['unit_price'] ?? null,
                isset($data['entry_date']) ? new \DateTime($data['entry_date']) : now(),
                'Initial stock',
                $request->user(),
            );
            $ingredient->refresh();
        }

        $this->audit->log('ingredient.created', $ingredient);

        return response()->json($ingredient, 201);
    }

    public function update(Request $request, Ingredient $ingredient): JsonResponse
    {
        $this->authorizeTenant($ingredient);

        $data = $request->validate([
            'name'       => ['sometimes', 'string', 'max:255'],
            'unit'       => ['sometimes', Rule::in(['gram', 'piece'])],
            'unit_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'is_active'  => ['sometimes', 'boolean'],
        ]);

        $ingredient->update($data);
        $this->audit->log('ingredient.updated', $ingredient, $data);

        return response()->json($ingredient);
    }

    public function destroy(Ingredient $ingredient): JsonResponse
    {
        $this->authorizeTenant($ingredient);

        $this->audit->log('ingredient.deleted', $ingredient);
        $ingredient->delete();

        return response()->json(['message' => 'Ingredient deleted.']);
    }

    /** Records a new purchase batch of this ingredient landing in the warehouse. */
    public function stockIn(Request $request, Ingredient $ingredient): JsonResponse
    {
        $this->authorizeTenant($ingredient);

        $data = $request->validate([
            'quantity'   => ['required', 'numeric', 'gt:0'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'entry_date' => ['nullable', 'date'],
            'notes'      => ['nullable', 'string', 'max:1000'],
        ]);

        $movement = $this->inventory->recordPurchase(
            Ingredient::class,
            $ingredient->id,
            (float) $data['quantity'],
            $data['unit_price'] ?? null,
            isset($data['entry_date']) ? new \DateTime($data['entry_date']) : now(),
            $data['notes'] ?? null,
            $request->user(),
        );

        if (isset($data['unit_price'])) {
            $ingredient->update(['unit_price' => $data['unit_price']]);
        }

        $this->audit->log('ingredient.stock_in', $ingredient, ['quantity' => $data['quantity']]);

        return response()->json(['ingredient' => $ingredient->fresh(), 'movement' => $movement], 201);
    }

    private function authorizeTenant(Ingredient $ingredient): void
    {
        abort_if((int) $ingredient->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
