<?php

namespace App\Services;

use App\Models\Order;
use App\Models\ProductionRecord;
use App\Models\SemiFinishedGood;
use App\Models\StockMovement;
use App\Models\User;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InventoryService
{
    /**
     * Deducts every recipe line's ingredients/semi-finished goods for a
     * completed order, once. Safe to call from more than one completion path
     * (table close, direct status update) — a second call is a no-op.
     *
     * Stock is never blocked from going negative: a POS sale should never
     * fail over a warehouse-sync issue, per the agreed policy — the negative
     * balance itself is the signal something needs restocking.
     */
    public function deductForOrder(Order $order): void
    {
        if ($order->stock_deducted_at) {
            return;
        }

        DB::transaction(function () use ($order) {
            $order->loadMissing('items.menuItem.recipeLines');

            foreach ($order->items as $item) {
                if (! $item->menuItem) {
                    // The MenuItem was deleted after this order was placed —
                    // its recipe is unrecoverable. Skip rather than fail the sale.
                    Log::info('Inventory: skipping stock deduction, menu item no longer exists.', [
                        'order_item_id' => $item->id,
                    ]);
                    continue;
                }

                foreach ($item->menuItem->recipeLines as $line) {
                    $this->deductComponent(
                        $line->componentable_type,
                        $line->componentable_id,
                        (float) $line->gross_quantity * $item->quantity,
                        $order,
                        StockMovement::REASON_SALE_DEDUCTION,
                    );
                }
            }

            $order->forceFill(['stock_deducted_at' => now()])->save();
        });
    }

    /**
     * Records producing a batch of a semi-finished good: consumes its own
     * recipe's raw ingredients (or other semi-finished goods) and adds the
     * produced quantity to its on-hand stock.
     */
    public function produceSemiFinishedGood(SemiFinishedGood $good, float $quantityProduced, User $user, ?string $notes = null): ProductionRecord
    {
        return DB::transaction(function () use ($good, $quantityProduced, $user, $notes) {
            $record = ProductionRecord::create([
                'semi_finished_good_id' => $good->id,
                'quantity_produced'     => $quantityProduced,
                'produced_at'           => now(),
                'produced_by_user_id'   => $user->id,
                'notes'                 => $notes,
            ]);

            foreach ($good->ownRecipeLines as $line) {
                $this->deductComponent(
                    $line->componentable_type,
                    $line->componentable_id,
                    (float) $line->gross_quantity * $quantityProduced,
                    $record,
                    StockMovement::REASON_PRODUCTION_CONSUMPTION,
                );
            }

            SemiFinishedGood::whereKey($good->id)->increment('current_stock', $quantityProduced);

            StockMovement::create([
                'stockable_type' => SemiFinishedGood::class,
                'stockable_id'   => $good->id,
                'type'           => StockMovement::TYPE_IN,
                'reason'         => StockMovement::REASON_PRODUCTION_OUTPUT,
                'quantity'       => $quantityProduced,
                'reference_type' => ProductionRecord::class,
                'reference_id'   => $record->id,
                'occurred_at'    => now(),
                'created_by'     => $user->id,
            ]);

            return $record;
        });
    }

    /**
     * A purchase of raw stock (ingredient or semi-finished good bought
     * ready-made) landing in the warehouse — the "entry date" from the spec
     * is `occurredAt`.
     */
    public function recordPurchase(
        string $stockableType,
        int $stockableId,
        float $quantity,
        ?float $unitPrice,
        DateTimeInterface $occurredAt,
        ?string $notes,
        User $user,
    ): StockMovement {
        return DB::transaction(function () use ($stockableType, $stockableId, $quantity, $unitPrice, $occurredAt, $notes, $user) {
            $stockableType::whereKey($stockableId)->increment('current_stock', $quantity);

            return StockMovement::create([
                'stockable_type' => $stockableType,
                'stockable_id'   => $stockableId,
                'type'           => StockMovement::TYPE_IN,
                'reason'         => StockMovement::REASON_PURCHASE,
                'quantity'       => $quantity,
                'unit_cost'      => $unitPrice,
                'total_cost'     => $unitPrice ? round($unitPrice * $quantity, 2) : null,
                'occurred_at'    => $occurredAt,
                'notes'          => $notes,
                'created_by'     => $user->id,
            ]);
        });
    }

    private function deductComponent(string $componentableType, int $componentableId, float $quantity, Model $reference, string $reason): void
    {
        $affected = $componentableType::whereKey($componentableId)->decrement('current_stock', $quantity);

        if (! $affected) {
            return;
        }

        StockMovement::create([
            'stockable_type' => $componentableType,
            'stockable_id'   => $componentableId,
            'type'           => StockMovement::TYPE_OUT,
            'reason'         => $reason,
            'quantity'       => $quantity,
            'reference_type' => $reference::class,
            'reference_id'   => $reference->getKey(),
            'occurred_at'    => now(),
        ]);
    }
}
