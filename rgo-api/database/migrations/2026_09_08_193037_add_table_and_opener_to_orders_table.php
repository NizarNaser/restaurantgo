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
        Schema::table('orders', function (Blueprint $table) {
            // Nullable, alongside the existing free-text table_number — that
            // stays for delivery/QR flows that don't go through a Hall/Table.
            $table->foreignId('table_id')->nullable()->after('qr_code_id')->constrained('tables')->nullOnDelete();
            $table->foreignId('opened_by_user_id')->nullable()->after('table_id')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['table_id']);
            $table->dropForeign(['opened_by_user_id']);
            $table->dropColumn(['table_id', 'opened_by_user_id']);
        });
    }
};
