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
        Schema::table('menu_items', function (Blueprint $table) {
            $table->json('seo_title_tmp')->nullable();
            $table->json('seo_description_tmp')->nullable();
        });

        DB::table('menu_items')
            ->join('tenants', 'tenants.id', '=', 'menu_items.tenant_id')
            ->orderBy('menu_items.id')
            ->get(['menu_items.id', 'menu_items.seo_title', 'menu_items.seo_description', 'tenants.default_locale'])
            ->each(function ($item) {
                $locale = $item->default_locale ?: 'en';
                DB::table('menu_items')->where('id', $item->id)->update([
                    'seo_title_tmp'       => $item->seo_title !== null && $item->seo_title !== '' ? json_encode([$locale => $item->seo_title]) : null,
                    'seo_description_tmp' => $item->seo_description !== null && $item->seo_description !== '' ? json_encode([$locale => $item->seo_description]) : null,
                ]);
            });

        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropColumn(['seo_title', 'seo_description']);
        });

        Schema::table('menu_items', function (Blueprint $table) {
            $table->renameColumn('seo_title_tmp', 'seo_title');
            $table->renameColumn('seo_description_tmp', 'seo_description');
        });
    }

    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            $table->string('seo_title_str')->nullable();
            $table->text('seo_description_str')->nullable();
        });

        DB::table('menu_items')
            ->join('tenants', 'tenants.id', '=', 'menu_items.tenant_id')
            ->orderBy('menu_items.id')
            ->get(['menu_items.id', 'menu_items.seo_title', 'menu_items.seo_description', 'tenants.default_locale'])
            ->each(function ($item) {
                $locale = $item->default_locale ?: 'en';
                $title = $item->seo_title ? (json_decode($item->seo_title, true)[$locale] ?? array_values(json_decode($item->seo_title, true) ?: [])[0] ?? null) : null;
                $description = $item->seo_description ? (json_decode($item->seo_description, true)[$locale] ?? array_values(json_decode($item->seo_description, true) ?: [])[0] ?? null) : null;
                DB::table('menu_items')->where('id', $item->id)->update([
                    'seo_title_str'       => $title,
                    'seo_description_str' => $description,
                ]);
            });

        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropColumn(['seo_title', 'seo_description']);
        });

        Schema::table('menu_items', function (Blueprint $table) {
            $table->renameColumn('seo_title_str', 'seo_title');
            $table->renameColumn('seo_description_str', 'seo_description');
        });
    }
};
