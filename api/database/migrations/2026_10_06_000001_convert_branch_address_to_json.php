<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Same single-value → per-locale JSON conversion as tenants/articles'
     * seo_title/seo_description (see 2026_09_16_000214): a branch's street
     * address is customer-facing free text, so it should be translatable
     * the same way. Implemented as add-backfill-drop-readd so it runs
     * identically on MySQL and the SQLite database the test suite uses.
     */
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->json('address_tmp')->nullable();
        });

        DB::table('branches')
            ->join('tenants', 'tenants.id', '=', 'branches.tenant_id')
            ->orderBy('branches.id')
            ->get(['branches.id', 'branches.address', 'tenants.default_locale'])
            ->each(function ($branch) {
                $locale = $branch->default_locale ?: 'en';
                DB::table('branches')->where('id', $branch->id)->update([
                    'address_tmp' => $branch->address !== null && $branch->address !== '' ? json_encode([$locale => $branch->address]) : null,
                ]);
            });

        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn('address');
        });

        Schema::table('branches', function (Blueprint $table) {
            $table->renameColumn('address_tmp', 'address');
        });
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->string('address_str')->nullable();
        });

        DB::table('branches')
            ->join('tenants', 'tenants.id', '=', 'branches.tenant_id')
            ->orderBy('branches.id')
            ->get(['branches.id', 'branches.address', 'tenants.default_locale'])
            ->each(function ($branch) {
                $locale = $branch->default_locale ?: 'en';
                $decoded = $branch->address ? json_decode($branch->address, true) : null;
                $address = $decoded ? ($decoded[$locale] ?? array_values($decoded)[0] ?? null) : null;
                DB::table('branches')->where('id', $branch->id)->update(['address_str' => $address]);
            });

        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn('address');
        });

        Schema::table('branches', function (Blueprint $table) {
            $table->renameColumn('address_str', 'address');
        });
    }
};
