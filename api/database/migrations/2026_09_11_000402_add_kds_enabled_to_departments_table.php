<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            // When enabled, this department gets a live kitchen-display
            // screen instead of (not in addition to) an auto-printed ticket.
            $table->boolean('kds_enabled')->default(false)->after('sort_order');
        });
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->dropColumn('kds_enabled');
        });
    }
};
