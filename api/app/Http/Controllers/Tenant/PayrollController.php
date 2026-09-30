<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\PayrollRunResource;
use App\Models\PayrollRun;
use App\Services\AuditService;
use App\Services\PayrollService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PayrollController extends Controller
{
    public function __construct(
        private readonly PayrollService $payroll,
        private readonly AuditService $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $runs = PayrollRun::where('tenant_id', $tenant->id)
            ->when($request->branch_id, fn($q) => $q->where('branch_id', $request->branch_id))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->with('items', 'creator', 'approver')
            ->orderByDesc('period_start')
            ->paginate($request->per_page ?? 20);

        return response()->json(PayrollRunResource::collection($runs)->response()->getData(true));
    }

    public function store(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $data = $request->validate([
            'period_start' => ['required', 'date'],
            'period_end'   => ['required', 'date', 'after_or_equal:period_start'],
            'branch_id'    => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        $run = $this->payroll->generate(
            $tenant,
            $data['period_start'],
            $data['period_end'],
            $data['branch_id'] ?? null,
            $request->user()->id,
        );

        $this->audit->log('payroll_run.generated', $run);

        return response()->json(new PayrollRunResource($run), 201);
    }

    public function show(PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeTenant($payrollRun);

        return response()->json(new PayrollRunResource($payrollRun->load('items.employee', 'creator', 'approver')));
    }

    public function approve(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeTenant($payrollRun);

        $run = $this->payroll->approve($payrollRun, $request->user()->id);
        $this->audit->log('payroll_run.approved', $run);

        return response()->json(new PayrollRunResource($run->load('items.employee', 'creator', 'approver')));
    }

    public function pay(PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeTenant($payrollRun);

        $run = $this->payroll->markPaid($payrollRun);
        $this->audit->log('payroll_run.paid', $run);

        return response()->json(new PayrollRunResource($run->load('items.employee', 'creator', 'approver')));
    }

    public function exportPdf(PayrollRun $payrollRun): Response
    {
        $this->authorizeTenant($payrollRun);

        $tenant = app('tenant');
        $payrollRun->load('items.employee', 'branch');

        $pdf = Pdf::loadView('pdf.payroll', [
            'tenant' => $tenant,
            'run'    => $payrollRun,
        ])->setPaper('a4');

        $filename = "payroll-{$payrollRun->period_start->format('Y-m-d')}-{$payrollRun->period_end->format('Y-m-d')}.pdf";

        return $pdf->download($filename);
    }

    private function authorizeTenant(PayrollRun $run): void
    {
        abort_if((int) $run->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
