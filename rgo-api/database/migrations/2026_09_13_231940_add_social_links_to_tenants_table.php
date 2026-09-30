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
            $table->string('social_facebook_url')->nullable();
            $table->string('social_instagram_url')->nullable();
            $table->string('social_twitter_url')->nullable();
            $table->string('social_tiktok_url')->nullable();
            $table->string('social_youtube_url')->nullable();
            $table->string('social_snapchat_url')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn([
                'social_facebook_url',
                'social_instagram_url',
                'social_twitter_url',
                'social_tiktok_url',
                'social_youtube_url',
                'social_snapchat_url',
            ]);
        });
    }
};
