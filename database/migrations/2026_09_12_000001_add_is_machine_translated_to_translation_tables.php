<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Marks a translation row as AI-generated and not yet reviewed by the
     * restaurant owner — surfaced in the dashboard's Translations page so it
     * can be double-checked, and cleared once they confirm it reads well.
     */
    public function up(): void
    {
        Schema::table('menu_item_translations', function (Blueprint $table) {
            $table->boolean('is_machine_translated')->default(false)->after('ingredients');
        });

        Schema::table('menu_category_translations', function (Blueprint $table) {
            $table->boolean('is_machine_translated')->default(false)->after('description');
        });

        Schema::table('article_translations', function (Blueprint $table) {
            $table->boolean('is_machine_translated')->default(false)->after('excerpt');
        });
    }

    public function down(): void
    {
        Schema::table('menu_item_translations', function (Blueprint $table) {
            $table->dropColumn('is_machine_translated');
        });

        Schema::table('menu_category_translations', function (Blueprint $table) {
            $table->dropColumn('is_machine_translated');
        });

        Schema::table('article_translations', function (Blueprint $table) {
            $table->dropColumn('is_machine_translated');
        });
    }
};
