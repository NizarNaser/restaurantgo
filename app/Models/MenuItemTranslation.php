<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MenuItemTranslation extends Model
{
    public $timestamps = false;
    protected $fillable = ['menu_item_id', 'locale', 'name', 'description', 'ingredients', 'is_machine_translated'];
    protected $casts = ['is_machine_translated' => 'boolean'];
}
