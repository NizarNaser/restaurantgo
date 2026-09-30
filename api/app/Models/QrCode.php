<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class QrCode extends Model
{
    use BelongsToTenant;

    const TYPE_MENU  = 'menu';
    const TYPE_ITEM   = 'item';
    const TYPE_TABLE = 'table';

    protected $fillable = [
        'tenant_id', 'branch_id', 'menu_category_id',
        'type', 'target_url', 'image_path', 'scan_count', 'table_number',
    ];

    protected $casts = [
        'scan_count' => 'integer',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function menuCategory()
    {
        return $this->belongsTo(MenuCategory::class);
    }
}
