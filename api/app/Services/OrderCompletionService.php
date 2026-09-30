<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Shift;
use Illuminate\Support\Facades\DB;

/**
 * Everything that must happen exactly once, the moment an order truly
 * becomes a finished sale — called from both places an order can reach
 * `status = completed` (TableController::close, OrderController::update).
 * Centralized here instead of duplicated in each controller as this
 * checklist grows (stock deduction, shift attribution, ...).
 */
class OrderCompletionService
{
    public function __construct(private readonly InventoryService $inventory)
    {
    }

    public function complete(Order $order): void
    {
        DB::transaction(function () use ($order) {
            $this->inventory->deductForOrder($order);

            // Attribute the sale to whichever shift is open right now — not
            // the shift that was open when the table was first opened, per
            // the agreed policy: a sale belongs to the shift that actually
            // collected the payment.
            if (! $order->shift_id) {
                $openShift = Shift::openShift()
                    ->when($order->branch_id, fn ($q) => $q->where(fn ($q) => $q->whereNull('branch_id')->orWhere('branch_id', $order->branch_id)))
                    ->latest('opened_at')
                    ->first();

                if ($openShift) {
                    $order->forceFill(['shift_id' => $openShift->id])->save();
                }
            }
        });
    }
}
