<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Payroll — {{ $run->period_start->format('Y-m-d') }} to {{ $run->period_end->format('Y-m-d') }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #1f2937; }
        .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .muted { color: #6b7280; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 6px; text-align: left; }
        th { background: #f9fafb; font-size: 11px; text-transform: uppercase; color: #6b7280; }
        td.num, th.num { text-align: right; }
        tfoot td { font-weight: bold; border-top: 2px solid #1f2937; border-bottom: none; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; text-transform: uppercase; background: #f3f4f6; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>{{ $tenant->name }}</h1>
            <div class="muted">Payroll — {{ $run->period_start->format('F j, Y') }} to {{ $run->period_end->format('F j, Y') }}</div>
            @if ($run->branch)
                <div class="muted">{{ $run->branch->name }}</div>
            @endif
        </div>
        <div style="text-align: right;">
            <span class="badge">{{ strtoupper($run->status) }}</span>
            <div class="muted" style="margin-top: 6px;">Currency: {{ $run->currency }}</div>
            @if ($run->processed_at)
                <div class="muted">Processed: {{ $run->processed_at->format('Y-m-d') }}</div>
            @endif
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Employee</th>
                <th>Position</th>
                <th class="num">Hours</th>
                <th class="num">Base salary</th>
                <th class="num">Overtime</th>
                <th class="num">Bonuses</th>
                <th class="num">Deductions</th>
                <th class="num">Net salary</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($run->items as $item)
                <tr>
                    <td>{{ $item->employee?->name ?? '—' }}</td>
                    <td>{{ $item->employee?->position ?? '—' }}</td>
                    <td class="num">{{ number_format($item->hours_worked, 1) }}</td>
                    <td class="num">{{ number_format($item->base_salary, 2) }}</td>
                    <td class="num">{{ number_format($item->overtime_pay, 2) }}</td>
                    <td class="num">{{ number_format($item->bonuses, 2) }}</td>
                    <td class="num">{{ number_format($item->deductions, 2) }}</td>
                    <td class="num">{{ number_format($item->net_salary, 2) }}</td>
                </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr>
                <td colspan="7">Total ({{ $run->items->count() }} employees)</td>
                <td class="num">{{ number_format($run->items->sum('net_salary'), 2) }} {{ $run->currency }}</td>
            </tr>
        </tfoot>
    </table>
</body>
</html>
