<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MenuCategoryTranslation extends Model
{
    public $timestamps = false;
    protected $fillable = ['menu_category_id', 'locale', 'name', 'description', 'is_machine_translated'];
    protected $casts = ['is_machine_translated' => 'boolean'];
}
