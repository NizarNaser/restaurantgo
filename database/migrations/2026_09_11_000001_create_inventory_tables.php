<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingredients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('unit'); // gram|piece
            $table->decimal('unit_price', 10, 4)->nullable(); // latest purchase price, informational
            $table->decimal('current_stock', 12, 3)->default(0); // running total; allowed to go negative
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'is_active']);
        });

        Schema::create('semi_finished_goods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('unit'); // gram|piece
            $table->decimal('current_stock', 12, 3)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'is_active']);
        });

        // One recipe line either belongs to a MenuItem's recipe card or to a
        // SemiFinishedGood's own production BOM (recipeable = "the thing being
        // made"), and consumes either a raw Ingredient or another
        // SemiFinishedGood (componentable = "the thing consumed"). Quantity is
        // always expressed in the componentable's own unit — no separate unit
        // column here, to avoid it ever disagreeing with the component's real one.
        Schema::create('recipe_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->morphs('recipeable');
            $table->morphs('componentable');
            $table->decimal('gross_quantity', 12, 3); // بروتو — what physically leaves the shelf, per 1 unit of the recipe owner
            $table->decimal('net_quantity', 12, 3)->nullable(); // نيتو — informational yield only, not deducted against
            $table->unsignedInteger('sort_order')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'recipeable_type', 'recipeable_id'], 'recipe_lines_tenant_recipeable_index');
        });

        // Audit ledger for every stock change on either an Ingredient or a
        // SemiFinishedGood — this is what the warehouse in/out report reads.
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->morphs('stockable');
            $table->string('type'); // in|out
            $table->string('reason'); // purchase|sale_deduction|production_consumption|production_output|manual_adjustment
            $table->decimal('quantity', 12, 3); // always positive; direction comes from `type`
            $table->decimal('unit_cost', 10, 4)->nullable();
            $table->decimal('total_cost', 12, 2)->nullable();
            $table->nullableMorphs('reference'); // Order (sale) or ProductionRecord (production)
            $table->dateTime('occurred_at'); // the "entry date" for a purchase, or when the sale/production happened
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'stockable_type', 'stockable_id'], 'stock_movements_tenant_stockable_index');
            $table->index(['tenant_id', 'occurred_at']);
            $table->index(['tenant_id', 'type']);
        });

        Schema::create('production_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('semi_finished_good_id')->constrained()->cascadeOnDelete();
            $table->decimal('quantity_produced', 12, 3);
            $table->dateTime('produced_at');
            $table->foreignId('produced_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('production_records');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('recipe_lines');
        Schema::dropIfExists('semi_finished_goods');
        Schema::dropIfExists('ingredients');
    }
};
