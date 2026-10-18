<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * How an order was (or will be) paid: `online` (Stripe checkout), `cash`
     * (collected by staff — at hand-over for delivery/pickup, or at the
     * table), `card` (card terminal at the table). Plus the per-restaurant
     * opt-in for offering cash on delivery/pickup orders at all.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_method')->nullable()->after('payment_status');
        });

        // Until now every delivery order went through online checkout; the
        // payment method of past dine-in bills was never recorded.
        DB::table('orders')->where('type', 'delivery')->update(['payment_method' => 'online']);

        Schema::table('tenants', function (Blueprint $table) {
            $table->boolean('cash_payments_enabled')->default(false)->after('paypal_email_confirmed');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('cash_payments_enabled');
        });
    }
};
