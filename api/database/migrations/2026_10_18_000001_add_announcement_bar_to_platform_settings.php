<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The scrolling notice bar above the marketing site's nav: whether it
     * shows, and an optional per-locale message (null = the site's built-in
     * translated beta notice). On by default, as the bar already shows.
     */
    public function up(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->boolean('announcement_enabled')->default(true);
            $table->json('announcement_message')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->dropColumn(['announcement_enabled', 'announcement_message']);
        });
    }
};
