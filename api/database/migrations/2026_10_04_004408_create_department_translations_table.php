<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('department_translations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->string('locale', 10);
            $table->string('name');
            $table->boolean('is_machine_translated')->default(false);
            $table->unique(['department_id', 'locale']);
        });

        // departments.name predates this table and stays in place as a
        // safety-net fallback (every read site prefers translation()->name
        // but falls back to it) — existing departments get exactly one
        // translation row seeded from their current name, under the
        // tenant's own default_locale rather than whatever locale happens
        // to be active during the migration run.
        DB::table('departments')
            ->join('tenants', 'tenants.id', '=', 'departments.tenant_id')
            ->select('departments.id', 'departments.name', 'tenants.default_locale')
            ->orderBy('departments.id')
            ->chunk(200, function ($departments) {
                DB::table('department_translations')->insert($departments->map(fn ($d) => [
                    'department_id' => $d->id,
                    'locale'        => $d->default_locale ?: 'en',
                    'name'          => $d->name,
                ])->all());
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('department_translations');
    }
};
