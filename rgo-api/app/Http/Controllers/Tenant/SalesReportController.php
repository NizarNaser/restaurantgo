<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Table;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class SalesReportController extends Controller
{
    /**
     * Income/discount/order-count totals for completed sales, filterable by
     * date, branch, shift, and the Department → Category → Menu Item chain.
     *
     * Two aggregation modes: with no product/category/department filter,
     * totals come straight off `orders` (so "discounts given" is accurate —
     * a discount applies to a whole invoice, not a line item). With any of
     * those filters, totals come from `order_items` instead, and discounts
     * are reported as null/unavailable rather than a misleading number,
     * since there's no per-line attribution of an order-level discount.
     */
    public function summary(Request $request): JsonResponse
    {
        $tenantId = app('tenant')->id;
        [$from, $to] = $this->resolveRange($request);
        $itemFiltered = $request->filled('department_id') || $request->filled('category_id') || $request->filled('menu_item_id');

        if ($itemFiltered) {
            $rows = OrderItem::query()
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->join('menu_items', 'menu_items.id', '=', 'order_items.menu_item_id')
                ->join('menu_categories', 'menu_categories.id', '=', 'menu_items.menu_category_id')
                ->where('orders.tenant_id', $tenantId)
                ->where('orders.status', 'completed')
                ->whereBetween('orders.created_at', [$from, $to])
                ->when($request->branch_id, fn ($q) => $q->where('orders.branch_id', $request->branch_id))
                ->when($request->shift_id, fn ($q) => $q->where('orders.shift_id', $request->shift_id))
                ->when($request->table_id, fn ($q) => $q->where('orders.table_id', $request->table_id))
                ->when($request->staff_id, fn ($q) => $q->where('orders.opened_by_user_id', $request->staff_id))
                ->when($request->department_id, fn ($q) => $q->where('menu_categories.department_id', $request->department_id))
                ->when($request->category_id, fn ($q) => $q->where('menu_items.menu_category_id', $request->category_id))
                ->when($request->menu_item_id, fn ($q) => $q->where('order_items.menu_item_id', $request->menu_item_id))
                ->selectRaw('COUNT(DISTINCT orders.id) as orders_count, COALESCE(SUM(order_items.subtotal), 0) as income, COALESCE(SUM(order_items.quantity), 0) as items_sold')
                ->first();

            return response()->json([
                'from'          => $from->toDateString(),
                'to'            => $to->toDateString(),
                'mode'          => 'items',
                'orders_count'  => (int) $rows->orders_count,
                'items_sold'    => (int) $rows->items_sold,
                'income'        => (float) $rows->income,
                'discounts'     => null, // not attributable per line item
                'average_order' => $rows->orders_count > 0 ? round((float) $rows->income / $rows->orders_count, 2) : 0,
            ]);
        }

        $orders = Order::where('tenant_id', $tenantId)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->when($request->branch_id, fn ($q) => $q->where('branch_id', $request->branch_id))
            ->when($request->shift_id, fn ($q) => $q->where('shift_id', $request->shift_id))
            ->when($request->table_id, fn ($q) => $q->where('table_id', $request->table_id))
            ->when($request->staff_id, fn ($q) => $q->where('opened_by_user_id', $request->staff_id));

        $ordersCount = (clone $orders)->count();
        $income = (float) (clone $orders)->sum('total');
        $discounts = (float) (clone $orders)->sum('discount_amount');

        return response()->json([
            'from'          => $from->toDateString(),
            'to'            => $to->toDateString(),
            'mode'          => 'orders',
            'orders_count'  => $ordersCount,
            'income'        => $income,
            'discounts'     => $discounts,
            'average_order' => $ordersCount > 0 ? round($income / $ordersCount, 2) : 0,
        ]);
    }

    /** Per-staff totals — who handled how much, using the table/order opener already on record. */
    public function byStaff(Request $request): JsonResponse
    {
        $tenantId = app('tenant')->id;
        [$from, $to] = $this->resolveRange($request);

        $rows = Order::where('tenant_id', $tenantId)
            ->where('status', 'completed')
            ->whereNotNull('opened_by_user_id')
            ->whereBetween('created_at', [$from, $to])
            ->when($request->branch_id, fn ($q) => $q->where('branch_id', $request->branch_id))
            ->selectRaw('opened_by_user_id, COUNT(*) as orders_count, COALESCE(SUM(total), 0) as income')
            ->groupBy('opened_by_user_id')
            ->with('openedBy:id,name')
            ->orderByDesc('income')
            ->get();

        return response()->json($rows->map(fn ($row) => [
            'user_id'      => $row->opened_by_user_id,
            'name'         => $row->openedBy?->name ?? 'Unknown',
            'orders_count' => (int) $row->orders_count,
            'income'       => (float) $row->income,
        ]));
    }

    /** Time-series income for the sales chart, grouped by day/week/month. */
    public function chartData(Request $request): JsonResponse
    {
        $tenantId = app('tenant')->id;
        [$from, $to] = $this->resolveRange($request);
        $groupBy = in_array($request->query('group_by'), ['day', 'week', 'month'], true) ? $request->query('group_by') : 'day';

        $orders = Order::where('tenant_id', $tenantId)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->when($request->branch_id, fn ($q) => $q->where('branch_id', $request->branch_id))
            ->when($request->table_id, fn ($q) => $q->where('table_id', $request->table_id))
            ->when($request->staff_id, fn ($q) => $q->where('opened_by_user_id', $request->staff_id))
            ->get(['created_at', 'total']);

        $byBucket = $orders->groupBy(function (Order $order) use ($groupBy) {
            return match ($groupBy) {
                'week'  => $order->created_at->startOfWeek()->toDateString(),
                'month' => $order->created_at->format('Y-m-01'),
                default => $order->created_at->toDateString(),
            };
        })->map(fn ($group) => (float) $group->sum('total'));

        $series = collect();
        $cursor = $from->copy();
        while ($cursor->lte($to)) {
            $key = match ($groupBy) {
                'week'  => $cursor->startOfWeek()->toDateString(),
                'month' => $cursor->format('Y-m-01'),
                default => $cursor->toDateString(),
            };

            if (! $series->contains('key', $key)) {
                $series->push([
                    'key'    => $key,
                    'label'  => $groupBy === 'month' ? Carbon::parse($key)->translatedFormat('M Y') : Carbon::parse($key)->translatedFormat('M j'),
                    'income' => (float) ($byBucket[$key] ?? 0),
                ]);
            }

            $cursor = match ($groupBy) {
                'week'  => $cursor->addWeek(),
                'month' => $cursor->addMonthNoOverflow(),
                default => $cursor->addDay(),
            };
        }

        return response()->json($series->values());
    }

    /**
     * A minimal table list for the report's filter dropdown — `/tables` and
     * `/floor/tables` both require a permission (`manage halls`/`manage
     * tables`) that `finance_manager`/`support_agent` don't hold even though
     * they hold `view reports`, so this endpoint stays inside the same
     * `view reports` group instead of reusing either of those.
     */
    public function tables(): JsonResponse
    {
        $tables = Table::where('tenant_id', app('tenant')->id)
            ->with('hall:id,name')
            ->orderBy('table_number')
            ->get(['id', 'table_number', 'hall_id']);

        return response()->json($tables->map(fn (Table $table) => [
            'id'           => $table->id,
            'table_number' => $table->table_number,
            'hall_name'    => $table->hall?->name,
        ]));
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function resolveRange(Request $request): array
    {
        $from = $request->query('from') ? Carbon::parse($request->query('from'))->startOfDay() : now()->startOfMonth();
        $to = $request->query('to') ? Carbon::parse($request->query('to'))->endOfDay() : now()->endOfDay();

        return [$from, $to];
    }
}
