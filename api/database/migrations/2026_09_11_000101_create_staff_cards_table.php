<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A physical staff card: swiped on a card reader to clock in/out (via
        // `card_identifier`, whatever raw value the reader emits), and prints
        // a short code the staff types on a phone/tablet to authenticate
        // table/reservation actions (`access_code`, hashed like a password).
        Schema::create('staff_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('card_identifier')->unique();
            $table->string('access_code');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            // Optional link to the HR payroll record, so a staff card's swipe
            // can feed the existing Employee/AttendanceRecord pipeline instead
            // of a second, parallel attendance system.
            $table->foreignId('employee_id')->nullable()->unique()->after('branch_id')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('employee_id');
        });

        Schema::dropIfExists('staff_cards');
    }
};
