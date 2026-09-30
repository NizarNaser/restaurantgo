<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Reservations (table / event bookings from the public directory) ──
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type')->default('table'); // table|event
            $table->string('customer_name');
            $table->string('customer_email')->nullable();
            $table->string('customer_phone');
            $table->unsignedInteger('party_size')->default(2);
            $table->string('event_name')->nullable();
            $table->dateTime('reserved_at');
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->string('status')->default('pending'); // pending|confirmed|cancelled|completed
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'reserved_at']);
        });

        // ── Advertisements (paid placements on the public marketing site) ──
        Schema::create('advertisements', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('advertiser_name')->nullable();
            $table->string('image_path')->nullable();
            $table->string('link_url')->nullable();
            $table->string('placement')->default('home_hero'); // home_hero|home_sidebar|directory_top|directory_sidebar
            $table->date('starts_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedBigInteger('impression_count')->default(0);
            $table->unsignedBigInteger('click_count')->default(0);
            $table->timestamps();

            $table->index(['placement', 'is_active']);
        });

        // ── Contact messages (public "Contact Us" submissions) ──
        Schema::create('contact_messages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('subject')->nullable();
            $table->text('message');
            $table->boolean('is_read')->default(false);
            $table->timestamps();
        });

        // ── Company staff (internal to the platform, not tied to any tenant) ──
        Schema::create('staff', function (Blueprint $table) {
            $table->id();
            // Set only for staff who also need a login to the company admin panel.
            $table->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('position');
            $table->string('department')->nullable();
            $table->decimal('base_salary', 12, 2)->default(0);
            $table->string('currency', 3)->default('USD');
            $table->decimal('overtime_rate', 4, 2)->default(1.50);
            $table->date('hire_date');
            $table->string('status')->default('active'); // active|inactive
            $table->text('bank_account')->nullable(); // encrypted
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('status');
        });

        Schema::create('staff_attendance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained()->cascadeOnDelete();
            $table->timestamp('check_in');
            $table->timestamp('check_out')->nullable();
            $table->string('type')->default('manual'); // manual|biometric|api
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['staff_id', 'check_in']);
        });

        Schema::create('staff_payroll_runs', function (Blueprint $table) {
            $table->id();
            $table->date('period_start');
            $table->date('period_end');
            $table->string('currency', 3)->default('USD');
            $table->string('status')->default('draft'); // draft|approved|paid
            $table->timestamp('processed_at')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('staff_payroll_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_payroll_run_id')->constrained('staff_payroll_runs')->cascadeOnDelete();
            $table->foreignId('staff_id')->constrained();
            $table->decimal('hours_worked', 8, 2)->default(0);
            $table->decimal('base_salary', 12, 2);
            $table->decimal('overtime_pay', 12, 2)->default(0);
            $table->decimal('bonuses', 12, 2)->default(0);
            $table->decimal('deductions', 12, 2)->default(0);
            $table->decimal('net_salary', 12, 2);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_payroll_items');
        Schema::dropIfExists('staff_payroll_runs');
        Schema::dropIfExists('staff_attendance_records');
        Schema::dropIfExists('staff');
        Schema::dropIfExists('contact_messages');
        Schema::dropIfExists('advertisements');
        Schema::dropIfExists('reservations');
    }
};
