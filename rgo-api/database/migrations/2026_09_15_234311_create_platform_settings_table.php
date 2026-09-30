<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // A single-row settings table for the platform's own marketing site
        // (the `web` app) — distinct from `tenants.seo_*`, which is each
        // restaurant's own SEO for their public page.
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->id();
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->string('seo_og_image', 2048)->nullable();
            $table->string('google_site_verification')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
    }
};
