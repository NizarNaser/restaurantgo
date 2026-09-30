<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add custom columns to the default Laravel users table
     * for multi-tenancy and SaaS features.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('tenant_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->string('phone')->nullable()->after('password');
            $table->string('avatar')->nullable()->after('phone');
            $table->string('locale', 10)->default('en')->after('avatar');
            $table->string('timezone')->default('UTC')->after('locale');
            $table->text('two_factor_secret')->nullable()->after('timezone');
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_secret');
            $table->timestamp('last_login_at')->nullable()->after('two_factor_confirmed_at');
            $table->boolean('is_active')->default(true)->after('last_login_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropColumn([
                'tenant_id', 'phone', 'avatar', 'locale', 'timezone',
                'two_factor_secret', 'two_factor_confirmed_at',
                'last_login_at', 'is_active',
            ]);
        });
    }
};
