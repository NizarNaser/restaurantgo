<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Printer;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PrinterController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        $printers = Printer::where('tenant_id', app('tenant')->id)
            ->with('department')
            ->orderBy('name')
            ->get();

        return response()->json($printers);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'department_id'   => ['nullable', 'integer', 'exists:departments,id'],
            'connection_type' => ['required', Rule::in(['wifi', 'bluetooth'])],
            'address'         => ['required', 'string', 'max:255'],
            'is_primary'      => ['nullable', 'boolean'],
        ]);

        $printer = Printer::create(array_merge($data, ['tenant_id' => app('tenant')->id]));
        $this->audit->log('printer.created', $printer);

        return response()->json($printer, 201);
    }

    public function update(Request $request, Printer $printer): JsonResponse
    {
        $this->authorizeTenant($printer);

        $data = $request->validate([
            'name'            => ['sometimes', 'string', 'max:255'],
            'department_id'   => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
            'connection_type' => ['sometimes', Rule::in(['wifi', 'bluetooth'])],
            'address'         => ['sometimes', 'string', 'max:255'],
            'is_primary'      => ['sometimes', 'boolean'],
        ]);

        $printer->update($data);
        $this->audit->log('printer.updated', $printer, $data);

        return response()->json($printer);
    }

    public function destroy(Printer $printer): JsonResponse
    {
        $this->authorizeTenant($printer);

        $this->audit->log('printer.deleted', $printer);
        $printer->delete();

        return response()->json(['message' => 'Printer deleted.']);
    }

    private function authorizeTenant(Printer $printer): void
    {
        abort_if((int) $printer->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
