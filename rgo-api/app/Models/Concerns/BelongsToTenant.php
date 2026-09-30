<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Structural replacement for the old convention of every controller manually
 * calling `where('tenant_id', app('tenant')->id)` on reads and
 * `abort_if($model->tenant_id !== ...)` on route-bound single records — a
 * pattern that worked only as long as every future controller remembered to
 * apply it by hand.
 *
 * A model using this trait is scoped to the current tenant automatically
 * (query, aggregate, or implicit route-model binding alike) whenever a tenant
 * is bound in the container — i.e. inside the `identify.tenant` middleware
 * group. It is a no-op for platform/super-admin routes and console commands,
 * which never bind a tenant and intentionally need cross-tenant access.
 *
 * Not applied to models with a deliberately nullable `tenant_id` (Coupon,
 * AuditLog) — those are platform-wide-or-tenant by design and already carry
 * their own explicit scoping.
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', function (Builder $builder) {
            if (app()->bound('tenant')) {
                $builder->where($builder->getModel()->getTable().'.tenant_id', app('tenant')->id);
            }
        });

        static::creating(function (Model $model) {
            if (! $model->getAttribute('tenant_id') && app()->bound('tenant')) {
                $model->setAttribute('tenant_id', app('tenant')->id);
            }
        });
    }

    public function scopeWithoutTenantScope(Builder $query): Builder
    {
        return $query->withoutGlobalScope('tenant');
    }
}
