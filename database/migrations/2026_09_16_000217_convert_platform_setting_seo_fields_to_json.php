<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The platform's own marketing site supports every locale it ships
     * translations for (see web/src/i18n/locales), so its SEO title/
     * description become one JSON object covering all of them, not a
     * single string. seo_og_image and google_site_verification stay as-is.
     */
    public function up(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->json('seo_title_tmp')->nullable();
            $table->json('seo_description_tmp')->nullable();
        });

        DB::table('platform_settings')->get(['id', 'seo_title', 'seo_description'])->each(function ($row) {
            DB::table('platform_settings')->where('id', $row->id)->update([
                'seo_title_tmp'       => $row->seo_title !== null && $row->seo_title !== '' ? json_encode(['en' => $row->seo_title]) : null,
                'seo_description_tmp' => $row->seo_description !== null && $row->seo_description !== '' ? json_encode(['en' => $row->seo_description]) : null,
            ]);
        });

        Schema::table('platform_settings', function (Blueprint $table) {
            $table->dropColumn(['seo_title', 'seo_description']);
        });

        Schema::table('platform_settings', function (Blueprint $table) {
            $table->renameColumn('seo_title_tmp', 'seo_title');
            $table->renameColumn('seo_description_tmp', 'seo_description');
        });
    }

    public function down(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->string('seo_title_str')->nullable();
            $table->string('seo_description_str', 500)->nullable();
        });

        DB::table('platform_settings')->get(['id', 'seo_title', 'seo_description'])->each(function ($row) {
            $title = $row->seo_title ? (json_decode($row->seo_title, true)['en'] ?? array_values(json_decode($row->seo_title, true) ?: [])[0] ?? null) : null;
            $description = $row->seo_description ? (json_decode($row->seo_description, true)['en'] ?? array_values(json_decode($row->seo_description, true) ?: [])[0] ?? null) : null;
            DB::table('platform_settings')->where('id', $row->id)->update([
                'seo_title_str'       => $title,
                'seo_description_str' => $description,
            ]);
        });

        Schema::table('platform_settings', function (Blueprint $table) {
            $table->dropColumn(['seo_title', 'seo_description']);
        });

        Schema::table('platform_settings', function (Blueprint $table) {
            $table->renameColumn('seo_title_str', 'seo_title');
            $table->renameColumn('seo_description_str', 'seo_description');
        });
    }
};
