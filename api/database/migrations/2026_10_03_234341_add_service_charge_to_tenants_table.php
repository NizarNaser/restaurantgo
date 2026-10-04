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
            // Mirrors tax_rate, but for an optional dine-in service charge —
            // deliberately separate toggles for "tell customers about it" and
            // "actually add it to the bill" since an owner may want either
            // independently (e.g. disclose it without charging yet, or vice
            // versa). Never applied to delivery/online orders.
            $table->decimal('service_charge_rate', 5, 2)->default(0)->after('tax_rate');
            $table->text('service_charge_message')->nullable()->after('service_charge_rate');
            $table->boolean('service_charge_show_message')->default(false)->after('service_charge_message');
            $table->boolean('service_charge_apply_to_invoice')->default(false)->after('service_charge_show_message');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn([
                'service_charge_rate',
                'service_charge_message',
                'service_charge_show_message',
                'service_charge_apply_to_invoice',
            ]);
        });
    }
};
