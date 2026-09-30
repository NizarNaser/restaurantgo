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
            // null = not applicable (dine-in); 'pending'/'paid' for delivery/takeout.
            $table->string('payment_status')->nullable()->after('type');
            $table->string('stripe_checkout_session_id')->nullable();
            $table->string('stripe_payment_intent_id')->nullable();
            $table->decimal('platform_fee_amount', 10, 2)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('delivery_address_line', 255)->nullable();
            $table->string('delivery_city', 120)->nullable();
            $table->text('delivery_instructions')->nullable();

            $table->index(['tenant_id', 'payment_status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'payment_status']);
            $table->dropColumn([
                'payment_status',
                'stripe_checkout_session_id',
                'stripe_payment_intent_id',
                'platform_fee_amount',
                'paid_at',
                'delivery_address_line',
                'delivery_city',
                'delivery_instructions',
            ]);
        });
    }
};
