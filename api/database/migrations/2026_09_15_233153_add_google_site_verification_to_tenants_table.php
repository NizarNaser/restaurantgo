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
        Schema::table('tenants', function (Blueprint $table) {
            // The content value of a `<meta name="google-site-verification">`
            // tag, so an owner can verify their restaurant's public site with
            // Google Search Console without needing DNS/hosting access.
            $table->string('google_site_verification')->nullable()->after('seo_og_image');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('google_site_verification');
        });
    }
};
