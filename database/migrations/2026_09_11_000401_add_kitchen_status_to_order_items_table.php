<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            // Per-department kitchen-screen progress — deliberately separate
            // from the parent Order's own status (which tracks the
            // payment/table lifecycle, not per-department prep progress).
            $table->string('kitchen_status')->default('pending')->after('notes'); // pending|preparing|ready
            $table->dateTime('started_at')->nullable()->after('kitchen_status');
            $table->dateTime('ready_at')->nullable()->after('started_at');
            $table->dateTime('collected_at')->nullable()->after('ready_at'); // hidden from the KDS screen
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['kitchen_status', 'started_at', 'ready_at', 'collected_at']);
        });
    }
};
