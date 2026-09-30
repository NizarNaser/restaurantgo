<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Models\SemiFinishedGood;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StockMovementController extends Controller
{
    /** The warehouse in/out ledger, filterable by date, item, and direction. */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'type'             => ['nullable', Rule::in(['in', 'out'])],
            'stockable_type'   => ['nullable', Rule::in(['ingredient', 'semi_finished_good'])],
            'stockable_id'     => ['nullable', 'integer'],
        ]);

        $stockableType = match ($request->stockable_type) {
            'ingredient' => Ingredient::class,
            'semi_finished_good' => SemiFinishedGood::class,
            default => null,
        };

        $movements = StockMovement::where('tenant_id', app('tenant')->id)
            ->with('stockable', 'createdBy')
            ->when($request->from, fn ($q) => $q->whereDate('occurred_at', '>=', $request->from))
            ->when($request->to, fn ($q) => $q->whereDate('occurred_at', '<=', $request->to))
            ->when($request->type, fn ($q) => $q->where('type', $request->type))
            ->when($stockableType, fn ($q) => $q->where('stockable_type', $stockableType))
            ->when($request->stockable_id, fn ($q) => $q->where('stockable_id', $request->stockable_id))
            ->orderByDesc('occurred_at')
            ->paginate($request->per_page ?? 50);

        return response()->json($movements);
    }
}
