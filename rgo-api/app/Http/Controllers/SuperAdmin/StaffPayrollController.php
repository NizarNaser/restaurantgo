<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Resources\StaffPayrollRunResource;
use App\Models\StaffPayrollRun;
use App\Services\AuditService;
use App\Services\StaffPayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffPayrollController extends Controller
{
    public function __construct(
        private readonly StaffPayrollService $payroll,
        private readonly AuditService $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $runs = StaffPayrollRun::when($request->status, fn ($q) => $q->where('status', $request->status))
            ->with('items', 'creator', 'approver')
            ->orderByDesc('period_start')
            ->paginate($request->per_page ?? 20);

        return response()->json(StaffPayrollRunResource::collection($runs)->response()->getData(true));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period_start' => ['required', 'date'],
            'period_end'   => ['required', 'date', 'after_or_equal:period_start'],
        ]);

        $run = $this->payroll->generate($data['period_start'], $data['period_end'], $request->user()->id);

        $this->audit->log('staff_payroll_run.generated', $run);

        return response()->json(new StaffPayrollRunResource($run), 201);
    }

    public function show(StaffPayrollRun $staffPayrollRun): JsonResponse
    {
        return response()->json(new StaffPayrollRunResource($staffPayrollRun->load('items.staff', 'creator', 'approver')));
    }

    public function approve(Request $request, StaffPayrollRun $staffPayrollRun): JsonResponse
    {
        $run = $this->payroll->approve($staffPayrollRun, $request->user()->id);
        $this->audit->log('staff_payroll_run.approved', $run);

        return response()->json(new StaffPayrollRunResource($run->load('items.staff', 'creator', 'approver')));
    }

    public function pay(StaffPayrollRun $staffPayrollRun): JsonResponse
    {
        $run = $this->payroll->markPaid($staffPayrollRun);
        $this->audit->log('staff_payroll_run.paid', $run);

        return response()->json(new StaffPayrollRunResource($run->load('items.staff', 'creator', 'approver')));
    }
}
