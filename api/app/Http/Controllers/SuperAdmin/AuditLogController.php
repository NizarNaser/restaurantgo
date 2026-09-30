<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * The audit trail (any tenant's actions, or platform-side ones with a
     * null tenant_id) was previously only reachable by querying the
     * database directly.
     */
    public function index(Request $request): JsonResponse
    {
        $logs = AuditLog::with(['tenant:id,name,slug', 'user:id,name,email'])
            ->when($request->tenant_id, fn ($q) => $q->where('tenant_id', $request->tenant_id))
            ->when($request->action, fn ($q) => $q->where('action', 'like', "%{$request->action}%"))
            ->when($request->user_id, fn ($q) => $q->where('user_id', $request->user_id))
            ->when($request->from, fn ($q) => $q->where('created_at', '>=', $request->from))
            ->when($request->to, fn ($q) => $q->where('created_at', '<=', $request->to))
            ->orderByDesc('created_at')
            ->paginate($request->per_page ?? 30);

        return response()->json($logs);
    }
}
