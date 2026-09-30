<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * seo_title/seo_description become one value per locale (JSON, keyed by
     * locale code) instead of a single string — a restaurant's SEO copy
     * should be translated the same way its menu/articles already are.
     * seo_og_image stays a single shared value; an image doesn't need
     * translating. Implemented as add-backfill-drop-readd (not a raw
     * MODIFY/CHANGE) so it runs identically on the MySQL app database and
     * the SQLite in-memory database the test suite uses.
     */
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->json('seo_title_tmp')->nullable();
            $table->json('seo_description_tmp')->nullable();
        });

        DB::table('tenants')->orderBy('id')->get(['id', 'seo_title', 'seo_description', 'default_locale'])->each(function ($tenant) {
            $locale = $tenant->default_locale ?: 'en';
            DB::table('tenants')->where('id', $tenant->id)->update([
                'seo_title_tmp'       => $tenant->seo_title !== null && $tenant->seo_title !== '' ? json_encode([$locale => $tenant->seo_title]) : null,
                'seo_description_tmp' => $tenant->seo_description !== null && $tenant->seo_description !== '' ? json_encode([$locale => $tenant->seo_description]) : null,
            ]);
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['seo_title', 'seo_description']);
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->renameColumn('seo_title_tmp', 'seo_title');
            $table->renameColumn('seo_description_tmp', 'seo_description');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('seo_title_str')->nullable();
            $table->text('seo_description_str')->nullable();
        });

        DB::table('tenants')->orderBy('id')->get(['id', 'seo_title', 'seo_description', 'default_locale'])->each(function ($tenant) {
            $locale = $tenant->default_locale ?: 'en';
            $title = $tenant->seo_title ? (json_decode($tenant->seo_title, true)[$locale] ?? array_values(json_decode($tenant->seo_title, true) ?: [])[0] ?? null) : null;
            $description = $tenant->seo_description ? (json_decode($tenant->seo_description, true)[$locale] ?? array_values(json_decode($tenant->seo_description, true) ?: [])[0] ?? null) : null;
            DB::table('tenants')->where('id', $tenant->id)->update([
                'seo_title_str'       => $title,
                'seo_description_str' => $description,
            ]);
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['seo_title', 'seo_description']);
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->renameColumn('seo_title_str', 'seo_title');
            $table->renameColumn('seo_description_str', 'seo_description');
        });
    }
};
