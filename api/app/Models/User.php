<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    protected $fillable = [
        'tenant_id', 'branch_id', 'employee_id', 'name', 'email', 'password',
        'phone', 'avatar', 'locale', 'timezone',
        'two_factor_secret', 'two_factor_confirmed_at',
        'last_login_at', 'is_active',
    ];

    protected $hidden = [
        'password', 'remember_token', 'two_factor_secret',
    ];

    protected $casts = [
        'email_verified_at'        => 'datetime',
        'two_factor_confirmed_at'  => 'datetime',
        'last_login_at'            => 'datetime',
        'password'                 => 'hashed',
        'is_active'                => 'boolean',
    ];

    // ── Relations ──────────────────────────────────────────────
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }

    /** The HR payroll record this login account is linked to, if any. */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function staffCard()
    {
        return $this->hasOne(StaffCard::class);
    }

    // ── Helpers ────────────────────────────────────────────────
    public function isSuperAdmin(): bool
    {
        return $this->hasRole('super_admin');
    }

    public function isTenantOwner(): bool
    {
        return $this->hasRole('owner');
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }
}
