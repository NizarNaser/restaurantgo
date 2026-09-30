<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Revenue;
use App\Services\AuditService;
use App\Services\ExchangeRateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinancialController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    // ── Summary ──────────────────────────────────────────────────

    public function summary(): JsonResponse
    {
        $tenantId = app('tenant')->id;
        $now      = now();

        $revenueThisMonth  = Revenue::where('tenant_id', $tenantId)
            ->whereYear('date', $now->year)->whereMonth('date', $now->month)
            ->sum('amount');

        $expenseThisMonth  = Expense::where('tenant_id', $tenantId)
            ->whereYear('date', $now->year)->whereMonth('date', $now->month)
            ->sum('amount');

        $revenueLastMonth  = Revenue::where('tenant_id', $tenantId)
            ->whereYear('date', $now->copy()->subMonth()->year)
            ->whereMonth('date', $now->copy()->subMonth()->month)
            ->sum('amount');

        $expenseLastMonth  = Expense::where('tenant_id', $tenantId)
            ->whereYear('date', $now->copy()->subMonth()->year)
            ->whereMonth('date', $now->copy()->subMonth()->month)
            ->sum('amount');

        return response()->json([
            'revenue_this_month'  => (float) $revenueThisMonth,
            'expense_this_month'  => (float) $expenseThisMonth,
            'profit_this_month'   => (float) ($revenueThisMonth - $expenseThisMonth),
            'revenue_last_month'  => (float) $revenueLastMonth,
            'expense_last_month'  => (float) $expenseLastMonth,
            'profit_last_month'   => (float) ($revenueLastMonth - $expenseLastMonth),
        ]);
    }

    // ── Revenues ─────────────────────────────────────────────────

    public function indexRevenues(): JsonResponse
    {
        $revenues = Revenue::where('tenant_id', app('tenant')->id)
            ->orderBy('date', 'desc')
            ->get();
        return response()->json($revenues);
    }

    public function storeRevenue(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount'           => ['required', 'numeric', 'min:0'],
            'currency'         => ['required', 'string', 'max:3'],
            'description'      => ['required', 'string', 'max:500'],
            'date'             => ['required', 'date'],
            'reference_number' => ['nullable', 'string', 'max:100'],
        ]);

        $revenue = Revenue::create([...$validated, 'tenant_id' => app('tenant')->id, 'created_by' => $request->user()->id]);
        $this->audit->log('revenue.created', $revenue);
        return response()->json($revenue, 201);
    }

    public function destroyRevenue(Revenue $revenue): JsonResponse
    {
        abort_if((int) $revenue->tenant_id !== (int) app('tenant')->id, 403);
        $this->audit->log('revenue.deleted', $revenue, ['old' => $revenue->only(['amount', 'currency', 'description', 'date'])]);
        $revenue->delete();
        return response()->json(['message' => 'Revenue deleted.']);
    }

    // ── Expenses ─────────────────────────────────────────────────

    public function indexExpenses(): JsonResponse
    {
        $expenses = Expense::where('tenant_id', app('tenant')->id)
            ->orderBy('date', 'desc')
            ->get();
        return response()->json($expenses);
    }

    public function storeExpense(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount'      => ['required', 'numeric', 'min:0'],
            'currency'    => ['required', 'string', 'max:3'],
            'description' => ['required', 'string', 'max:500'],
            'date'        => ['required', 'date'],
            'vendor'      => ['nullable', 'string', 'max:255'],
        ]);

        $expense = Expense::create([...$validated, 'tenant_id' => app('tenant')->id, 'created_by' => $request->user()->id]);
        $this->audit->log('expense.created', $expense);
        return response()->json($expense, 201);
    }

    public function destroyExpense(Expense $expense): JsonResponse
    {
        abort_if((int) $expense->tenant_id !== (int) app('tenant')->id, 403);
        $this->audit->log('expense.deleted', $expense, ['old' => $expense->only(['amount', 'currency', 'description', 'date'])]);
        $expense->delete();
        return response()->json(['message' => 'Expense deleted.']);
    }

    /**
     * Sum a Revenue/Expense collection's `amount` grouped by "Y-m", driver-agnostic
     * (avoids DB-specific date-formatting SQL across sqlite/mysql/pgsql environments).
     *
     * @param  Collection<int, Revenue|Expense>  $rows
     * @return Collection<string, float>
     */
    private function sumByMonth(Collection $rows): Collection
    {
        return $rows->groupBy(fn ($row) => $row->date->format('Y-m'))
            ->map(fn (Collection $group) => (float) $group->sum('amount'));
    }

    // ── Chart data ───────────────────────────────────────────────

    /**
     * Revenue vs. expense totals per month for the last N months (default 6).
     */
    public function chartData(Request $request): JsonResponse
    {
        $tenantId = app('tenant')->id;
        $months   = max(1, min(24, (int) $request->query('months', 6)));
        $start    = now()->startOfMonth()->subMonths($months - 1);

        $revenueByMonth = $this->sumByMonth(Revenue::where('tenant_id', $tenantId)->where('date', '>=', $start)->get());
        $expenseByMonth = $this->sumByMonth(Expense::where('tenant_id', $tenantId)->where('date', '>=', $start)->get());

        $series = collect(range(0, $months - 1))->map(function (int $i) use ($start, $revenueByMonth, $expenseByMonth) {
            $month   = $start->copy()->addMonths($i);
            $key     = $month->format('Y-m');
            $revenue = (float) ($revenueByMonth[$key] ?? 0);
            $expense = (float) ($expenseByMonth[$key] ?? 0);

            return [
                'month'   => $key,
                'label'   => $month->translatedFormat('M Y'),
                'revenue' => $revenue,
                'expense' => $expense,
                'profit'  => $revenue - $expense,
            ];
        });

        return response()->json($series);
    }

    // ── Profit & Loss report ────────────────────────────────────

    public function profitLoss(Request $request): JsonResponse
    {
        $tenantId = app('tenant')->id;
        $from = $request->query('from') ? now()->parse($request->query('from')) : now()->startOfYear();
        $to   = $request->query('to') ? now()->parse($request->query('to')) : now()->endOfMonth();

        $revenueByMonth = $this->sumByMonth(Revenue::where('tenant_id', $tenantId)->whereBetween('date', [$from, $to])->get());
        $expenseByMonth = $this->sumByMonth(Expense::where('tenant_id', $tenantId)->whereBetween('date', [$from, $to])->get());

        $months = collect();
        $cursor = $from->copy()->startOfMonth();
        while ($cursor->lte($to)) {
            $months->push($cursor->format('Y-m'));
            $cursor->addMonth();
        }

        $rows = $months->map(function (string $key) use ($revenueByMonth, $expenseByMonth) {
            $revenue = (float) ($revenueByMonth[$key] ?? 0);
            $expense = (float) ($expenseByMonth[$key] ?? 0);

            return [
                'month'   => $key,
                'label'   => \Illuminate\Support\Carbon::createFromFormat('Y-m', $key)->translatedFormat('M Y'),
                'revenue' => $revenue,
                'expense' => $expense,
                'profit'  => $revenue - $expense,
            ];
        });

        return response()->json([
            'from'  => $from->toDateString(),
            'to'    => $to->toDateString(),
            'rows'  => $rows,
            'totals' => [
                'revenue' => (float) $rows->sum('revenue'),
                'expense' => (float) $rows->sum('expense'),
                'profit'  => (float) $rows->sum('profit'),
            ],
        ]);
    }

    // ── Exchange rates ───────────────────────────────────────────

    public function exchangeRates(ExchangeRateService $service): JsonResponse
    {
        return response()->json([
            'base'  => 'USD',
            'rates' => $service->latestRates(),
        ]);
    }

    // ── Excel export ─────────────────────────────────────────────

    public function exportExcel(Request $request, string $type): StreamedResponse
    {
        abort_unless(in_array($type, ['revenues', 'expenses'], true), 404);

        $tenantId = app('tenant')->id;
        $isRevenue = $type === 'revenues';

        /** @var Collection $rows */
        $rows = $isRevenue
            ? Revenue::where('tenant_id', $tenantId)->orderBy('date')->get()
            : Expense::where('tenant_id', $tenantId)->orderBy('date')->get();

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle(ucfirst($type));

        $headers = $isRevenue
            ? ['Date', 'Description', 'Amount', 'Currency', 'Reference #']
            : ['Date', 'Description', 'Amount', 'Currency', 'Vendor'];
        $sheet->fromArray($headers, null, 'A1');
        $sheet->getStyle('A1:E1')->getFont()->setBold(true);

        $line = 2;
        foreach ($rows as $row) {
            $sheet->fromArray([
                $row->date->toDateString(),
                $row->description,
                (float) $row->amount,
                $row->currency,
                $isRevenue ? $row->reference_number : $row->vendor,
            ], null, "A{$line}");
            $line++;
        }

        foreach (range('A', 'E') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }

        $filename = "{$type}-".now()->format('Y-m-d').'.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            (new Xlsx($spreadsheet))->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }
}
