<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Same single-value → per-locale JSON conversion as the tenant's own
     * seo_title/seo_description (see 2026_09_16_000214): the service-charge
     * note is shown to every customer on the public menu, so it needs to be
     * translatable the same way instead of always appearing in whichever
     * language the owner first typed it in.
     */
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->json('service_charge_message_tmp')->nullable();
        });

        DB::table('tenants')->orderBy('id')->get(['id', 'service_charge_message', 'default_locale'])->each(function ($tenant) {
            $locale = $tenant->default_locale ?: 'en';
            DB::table('tenants')->where('id', $tenant->id)->update([
                'service_charge_message_tmp' => $tenant->service_charge_message !== null && $tenant->service_charge_message !== ''
                    ? json_encode([$locale => $tenant->service_charge_message])
                    : null,
            ]);
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('service_charge_message');
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->renameColumn('service_charge_message_tmp', 'service_charge_message');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('service_charge_message_str', 500)->nullable();
        });

        DB::table('tenants')->orderBy('id')->get(['id', 'service_charge_message', 'default_locale'])->each(function ($tenant) {
            $locale = $tenant->default_locale ?: 'en';
            $decoded = $tenant->service_charge_message ? json_decode($tenant->service_charge_message, true) : null;
            $message = $decoded ? ($decoded[$locale] ?? array_values($decoded)[0] ?? null) : null;
            DB::table('tenants')->where('id', $tenant->id)->update(['service_charge_message_str' => $message]);
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('service_charge_message');
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->renameColumn('service_charge_message_str', 'service_charge_message');
        });
    }
};
