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
            $table->string('paypal_merchant_id')->nullable();
            $table->boolean('paypal_payments_receivable')->default(false);
            $table->boolean('paypal_email_confirmed')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['paypal_merchant_id', 'paypal_payments_receivable', 'paypal_email_confirmed']);
        });
    }
};
