<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DepartmentTranslation extends Model
{
    public $timestamps = false;
    protected $fillable = ['department_id', 'locale', 'name', 'is_machine_translated'];
    protected $casts = ['is_machine_translated' => 'boolean'];
}
