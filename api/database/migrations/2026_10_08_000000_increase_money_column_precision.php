<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Every genuinely currency-denominated column in the app was created as
     * `decimal(x, 2)` — fine for most currencies, but it silently truncates
     * the third decimal place for any tenant billing in a 3-decimal Gulf/
     * Maghreb currency (KWD/BHD/OMR/JOD/TND): a 1.234 KWD line item gets
     * stored as 1.23, not just displayed that way. This widens those
     * columns' scale to 3 so the extra decimal survives storage; the
     * matching Eloquent `decimal:3` casts (and the new `App\Services\
     * Currency` helper for every place that used to hardcode
     * `round($x, 2)`) ship alongside this migration. Rate/percentage/
     * quantity columns (tax_rate, discount_percentage, overtime_rate,
     * hours_worked, …) are untouched — they aren't money amounts, so the
     * Gulf-currency bug never applied to them.
     */
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->decimal('price_monthly', 11, 3)->default(0)->change();
            $table->decimal('price_yearly', 11, 3)->default(0)->change();
        });

        Schema::table('menu_items', function (Blueprint $table) {
            $table->decimal('base_price', 11, 3)->default(0)->change();
        });

        Schema::table('menu_item_prices', function (Blueprint $table) {
            $table->decimal('price', 11, 3)->change();
        });

        Schema::table('employees', function (Blueprint $table) {
            $table->decimal('base_salary', 13, 3)->change();
        });

        Schema::table('staff', function (Blueprint $table) {
            $table->decimal('base_salary', 13, 3)->default(0)->change();
        });

        Schema::table('payroll_items', function (Blueprint $table) {
            $table->decimal('base_salary', 13, 3)->change();
            $table->decimal('overtime_pay', 13, 3)->default(0)->change();
            $table->decimal('bonuses', 13, 3)->default(0)->change();
            $table->decimal('deductions', 13, 3)->default(0)->change();
            $table->decimal('net_salary', 13, 3)->change();
        });

        Schema::table('staff_payroll_items', function (Blueprint $table) {
            $table->decimal('base_salary', 13, 3)->change();
            $table->decimal('overtime_pay', 13, 3)->default(0)->change();
            $table->decimal('bonuses', 13, 3)->default(0)->change();
            $table->decimal('deductions', 13, 3)->default(0)->change();
            $table->decimal('net_salary', 13, 3)->change();
        });

        Schema::table('revenues', function (Blueprint $table) {
            $table->decimal('amount', 15, 3)->change();
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->decimal('amount', 15, 3)->change();
        });

        Schema::table('coupons', function (Blueprint $table) {
            $table->decimal('value', 11, 3)->change();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('subtotal', 11, 3)->default(0)->change();
            $table->decimal('total', 11, 3)->default(0)->change();
            $table->decimal('platform_fee_amount', 11, 3)->nullable()->change();
            $table->decimal('discount_amount', 11, 3)->default(0)->change();
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('unit_price', 11, 3)->change();
            $table->decimal('subtotal', 11, 3)->change();
        });

        Schema::table('discount_cards', function (Blueprint $table) {
            $table->decimal('accumulated_balance', 13, 3)->default(0)->change();
        });

        Schema::table('discount_applications', function (Blueprint $table) {
            $table->decimal('amount', 13, 3)->change();
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->decimal('total_cost', 13, 3)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->decimal('price_monthly', 10, 2)->default(0)->change();
            $table->decimal('price_yearly', 10, 2)->default(0)->change();
        });

        Schema::table('menu_items', function (Blueprint $table) {
            $table->decimal('base_price', 10, 2)->default(0)->change();
        });

        Schema::table('menu_item_prices', function (Blueprint $table) {
            $table->decimal('price', 10, 2)->change();
        });

        Schema::table('employees', function (Blueprint $table) {
            $table->decimal('base_salary', 12, 2)->change();
        });

        Schema::table('staff', function (Blueprint $table) {
            $table->decimal('base_salary', 12, 2)->default(0)->change();
        });

        Schema::table('payroll_items', function (Blueprint $table) {
            $table->decimal('base_salary', 12, 2)->change();
            $table->decimal('overtime_pay', 12, 2)->default(0)->change();
            $table->decimal('bonuses', 12, 2)->default(0)->change();
            $table->decimal('deductions', 12, 2)->default(0)->change();
            $table->decimal('net_salary', 12, 2)->change();
        });

        Schema::table('staff_payroll_items', function (Blueprint $table) {
            $table->decimal('base_salary', 12, 2)->change();
            $table->decimal('overtime_pay', 12, 2)->default(0)->change();
            $table->decimal('bonuses', 12, 2)->default(0)->change();
            $table->decimal('deductions', 12, 2)->default(0)->change();
            $table->decimal('net_salary', 12, 2)->change();
        });

        Schema::table('revenues', function (Blueprint $table) {
            $table->decimal('amount', 14, 2)->change();
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->decimal('amount', 14, 2)->change();
        });

        Schema::table('coupons', function (Blueprint $table) {
            $table->decimal('value', 10, 2)->change();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('subtotal', 10, 2)->default(0)->change();
            $table->decimal('total', 10, 2)->default(0)->change();
            $table->decimal('platform_fee_amount', 10, 2)->nullable()->change();
            $table->decimal('discount_amount', 10, 2)->default(0)->change();
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('unit_price', 10, 2)->change();
            $table->decimal('subtotal', 10, 2)->change();
        });

        Schema::table('discount_cards', function (Blueprint $table) {
            $table->decimal('accumulated_balance', 12, 2)->default(0)->change();
        });

        Schema::table('discount_applications', function (Blueprint $table) {
            $table->decimal('amount', 12, 2)->change();
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->decimal('total_cost', 12, 2)->nullable()->change();
        });
    }
};
