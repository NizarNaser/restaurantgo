<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Same seo_title/seo_description → per-locale JSON conversion as tenants; see that migration's docblock. */
    public function up(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->json('seo_title_tmp')->nullable();
            $table->json('seo_description_tmp')->nullable();
        });

        DB::table('articles')
            ->join('tenants', 'tenants.id', '=', 'articles.tenant_id')
            ->orderBy('articles.id')
            ->get(['articles.id', 'articles.seo_title', 'articles.seo_description', 'tenants.default_locale'])
            ->each(function ($article) {
                $locale = $article->default_locale ?: 'en';
                DB::table('articles')->where('id', $article->id)->update([
                    'seo_title_tmp'       => $article->seo_title !== null && $article->seo_title !== '' ? json_encode([$locale => $article->seo_title]) : null,
                    'seo_description_tmp' => $article->seo_description !== null && $article->seo_description !== '' ? json_encode([$locale => $article->seo_description]) : null,
                ]);
            });

        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn(['seo_title', 'seo_description']);
        });

        Schema::table('articles', function (Blueprint $table) {
            $table->renameColumn('seo_title_tmp', 'seo_title');
            $table->renameColumn('seo_description_tmp', 'seo_description');
        });
    }

    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->string('seo_title_str')->nullable();
            $table->text('seo_description_str')->nullable();
        });

        DB::table('articles')
            ->join('tenants', 'tenants.id', '=', 'articles.tenant_id')
            ->orderBy('articles.id')
            ->get(['articles.id', 'articles.seo_title', 'articles.seo_description', 'tenants.default_locale'])
            ->each(function ($article) {
                $locale = $article->default_locale ?: 'en';
                $title = $article->seo_title ? (json_decode($article->seo_title, true)[$locale] ?? array_values(json_decode($article->seo_title, true) ?: [])[0] ?? null) : null;
                $description = $article->seo_description ? (json_decode($article->seo_description, true)[$locale] ?? array_values(json_decode($article->seo_description, true) ?: [])[0] ?? null) : null;
                DB::table('articles')->where('id', $article->id)->update([
                    'seo_title_str'       => $title,
                    'seo_description_str' => $description,
                ]);
            });

        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn(['seo_title', 'seo_description']);
        });

        Schema::table('articles', function (Blueprint $table) {
            $table->renameColumn('seo_title_str', 'seo_title');
            $table->renameColumn('seo_description_str', 'seo_description');
        });
    }
};
