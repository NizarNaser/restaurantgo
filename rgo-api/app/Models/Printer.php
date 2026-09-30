<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Printer extends Model
{
    use BelongsToTenant;

    public const CONNECTION_WIFI = 'wifi';
    public const CONNECTION_BLUETOOTH = 'bluetooth';

    protected $fillable = ['tenant_id', 'department_id', 'name', 'connection_type', 'address', 'is_primary'];

    protected $casts = [
        'is_primary' => 'boolean',
    ];

    protected $attributes = [
        'connection_type' => self::CONNECTION_WIFI,
        'is_primary'      => false,
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }
}
