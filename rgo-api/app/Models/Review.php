<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'menu_item_id', 'branch_id',
        'customer_name', 'customer_email', 'rating', 'comment',
        'is_approved',
    ];

    protected $casts = [
        'rating'      => 'integer',
        'is_approved' => 'boolean',
    ];

    public function tenant()   { return $this->belongsTo(Tenant::class); }
    public function menuItem() { return $this->belongsTo(MenuItem::class); }
    public function branch()   { return $this->belongsTo(Branch::class); }

    public function scopeApproved($query)
    {
        return $query->where('is_approved', true);
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }
}
