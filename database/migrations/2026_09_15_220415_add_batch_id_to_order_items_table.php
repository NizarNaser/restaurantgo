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
        Schema::table('order_items', function (Blueprint $table) {
            // Groups every row written by one addItems() call into a single
            // kitchen ticket — the KDS shows one card per batch, not one per
            // (whole, possibly multi-round) order, so a second round for the
            // same table shows up as its own ticket alongside an earlier
            // one that's already preparing/ready. Null for rows written
            // before this column existed; those just fall back to one
            // legacy ticket per order, same as the old behavior.
            $table->uuid('batch_id')->nullable()->after('notes');
            $table->index('batch_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropIndex(['batch_id']);
            $table->dropColumn('batch_id');
        });
    }
};
