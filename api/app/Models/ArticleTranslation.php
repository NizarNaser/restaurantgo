<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ArticleTranslation extends Model
{
    public $timestamps = false;

    protected $fillable = ['article_id', 'locale', 'title', 'slug', 'content', 'excerpt', 'is_machine_translated'];
    protected $casts = ['is_machine_translated' => 'boolean'];

    public function article()
    {
        return $this->belongsTo(Article::class);
    }
}
