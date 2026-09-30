<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MenuItemPrice extends Model
{
    public $timestamps = false;
    protected $fillable = ['menu_item_id', 'currency', 'price'];
}
