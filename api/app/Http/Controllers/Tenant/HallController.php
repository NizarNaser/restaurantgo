<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Hall;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HallController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        $halls = Hall::where('tenant_id', app('tenant')->id)
            ->withCount('tables')
            ->orderBy('sort_order')
            ->get();

        return response()->json($halls);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'branch_id'  => ['nullable', 'integer', 'exists:branches,id'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $hall = Hall::create(array_merge($data, ['tenant_id' => app('tenant')->id]));
        $this->audit->log('hall.created', $hall);

        return response()->json($hall, 201);
    }

    public function update(Request $request, Hall $hall): JsonResponse
    {
        $this->authorizeTenant($hall);

        $data = $request->validate([
            'name'       => ['sometimes', 'string', 'max:255'],
            'branch_id'  => ['sometimes', 'nullable', 'integer', 'exists:branches,id'],
            'sort_order' => ['sometimes', 'integer'],
            'is_active'  => ['sometimes', 'boolean'],
        ]);

        $hall->update($data);
        $this->audit->log('hall.updated', $hall, $data);

        return response()->json($hall);
    }

    public function destroy(Hall $hall): JsonResponse
    {
        $this->authorizeTenant($hall);

        $this->audit->log('hall.deleted', $hall);
        $hall->delete();

        return response()->json(['message' => 'Hall deleted.']);
    }

    private function authorizeTenant(Hall $hall): void
    {
        abort_if((int) $hall->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
