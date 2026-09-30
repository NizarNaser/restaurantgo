<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use App\Models\StaffAttendanceRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffAttendanceController extends Controller
{
    public function checkin(Request $request): JsonResponse
    {
        $request->validate(['staff_id' => 'required|integer', 'notes' => 'nullable|string']);

        $staff = Staff::findOrFail($request->staff_id);

        $open = StaffAttendanceRecord::where('staff_id', $staff->id)
            ->whereNull('check_out')
            ->latest()
            ->first();

        if ($open) {
            return response()->json(['message' => 'Staff member already checked in.'], 422);
        }

        $record = StaffAttendanceRecord::create([
            'staff_id'   => $staff->id,
            'check_in'   => now(),
            'type'       => 'manual',
            'notes'      => $request->notes,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Checked in.', 'record' => $record], 201);
    }

    public function checkout(Request $request): JsonResponse
    {
        $request->validate(['staff_id' => 'required|integer', 'notes' => 'nullable|string']);

        $record = StaffAttendanceRecord::where('staff_id', $request->staff_id)
            ->whereNull('check_out')
            ->latest()
            ->firstOrFail();

        $record->update(['check_out' => now(), 'notes' => $request->notes ?? $record->notes]);

        return response()->json([
            'message'      => 'Checked out.',
            'hours_worked' => $record->hoursWorked(),
            'record'       => $record,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $records = StaffAttendanceRecord::when($request->staff_id, fn ($q) => $q->where('staff_id', $request->staff_id))
            ->when($request->from, fn ($q) => $q->where('check_in', '>=', $request->from))
            ->when($request->to, fn ($q) => $q->where('check_in', '<=', $request->to))
            ->with('staff')
            ->latest('check_in')
            ->paginate($request->per_page ?? 30);

        return response()->json($records);
    }
}
