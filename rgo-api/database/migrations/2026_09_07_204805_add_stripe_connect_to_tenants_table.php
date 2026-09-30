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
            $table->string('stripe_connect_account_id')->nullable()->after('settings');
            $table->boolean('stripe_connect_charges_enabled')->default(false)->after('stripe_connect_account_id');
            $table->boolean('stripe_connect_details_submitted')->default(false)->after('stripe_connect_charges_enabled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['stripe_connect_account_id', 'stripe_connect_charges_enabled', 'stripe_connect_details_submitted']);
        });
    }
};
