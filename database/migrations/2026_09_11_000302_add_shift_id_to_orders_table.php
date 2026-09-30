<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Stamped when the order completes (not when it's opened) — the
            // shift a sale belongs to is whichever one is open at the moment
            // it's actually paid, so a table opened just before shift-close
            // and paid just after correctly lands in the new shift.
            $table->foreignId('shift_id')->nullable()->after('stock_deducted_at')
                ->constrained('shifts')->nullOnDelete();
            $table->index(['tenant_id', 'shift_id']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('shift_id');
        });
    }
};
