<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class AuditService
{
    /**
     * @param  Model|null  $actor  Who performed the action. Defaults to the authenticated
     *                             guard user, but login doesn't go through Auth::login() before
     *                             this fires (it's a manual credential check), so callers there
     *                             must pass the user explicitly.
     */
    public function log(string $action, Model $model, array $extra = [], ?Model $actor = null): void
    {
        // Not every audited action happens inside the identify.tenant middleware
        // (e.g. login, which runs before a tenant is resolved) — fall back to the
        // model's own tenant_id rather than assuming the binding exists.
        $tenant   = app()->bound('tenant') ? app('tenant') : null;
        $tenantId = $tenant?->id ?? $model->getAttribute('tenant_id');
        $user     = $actor ?? Auth::user();

        AuditLog::create([
            'tenant_id'  => $tenantId,
            'user_id'    => $user?->id,
            'action'     => $action,
            'model_type' => get_class($model),
            'model_id'   => $model->getKey(),
            'old_values' => $extra['old'] ?? null,
            'new_values' => $extra['new'] ?? ($model->wasRecentlyCreated ? null : $model->getChanges()),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }
}
