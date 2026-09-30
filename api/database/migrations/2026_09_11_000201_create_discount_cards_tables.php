<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discount_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('card_number');
            $table->string('customer_name');
            $table->date('customer_birth_date')->nullable();
            $table->string('customer_phone')->nullable();
            $table->string('customer_email')->nullable();
            $table->decimal('discount_percentage', 5, 2);
            $table->decimal('accumulated_balance', 12, 2)->default(0); // currency-denominated credit
            $table->boolean('is_active')->default(true);
            $table->foreignId('registered_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'card_number']);
        });

        // One request/approval event on an order against a card — 'deduct'
        // (off this invoice), 'accumulate' (credit for later, this invoice
        // untouched), or 'redeem' (spend previously-accumulated credit).
        Schema::create('discount_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('discount_card_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('mode'); // deduct|accumulate|redeem
            $table->decimal('discount_percentage', 5, 2)->nullable(); // snapshot at request time (deduct/accumulate)
            $table->decimal('amount', 12, 2); // the computed discount, or the redeemed amount
            $table->string('status')->default('pending'); // pending|approved|rejected
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('approved_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'order_id']);
            $table->index(['tenant_id', 'discount_card_id']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('discount_card_id')->nullable()->after('shift_id')
                ->constrained('discount_cards')->nullOnDelete();
            $table->decimal('discount_amount', 10, 2)->default(0)->after('discount_card_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('discount_card_id');
            $table->dropColumn('discount_amount');
        });

        Schema::dropIfExists('discount_applications');
        Schema::dropIfExists('discount_cards');
    }
};
