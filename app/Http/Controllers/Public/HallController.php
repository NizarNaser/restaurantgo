<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\Concerns\ResolvesPublicTenant;
use App\Models\Hall;
use App\Models\QrCode;
use App\Models\Table;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A read-only floor view for customers: after choosing "dine-in" on the
 * public menu page, this is what lets them find their table by its real
 * position and see whether it's free — not a management surface, so it
 * deliberately omits who opened a table and its running bill (that stays
 * staff-only, in Tenant\TableController::floor()).
 */
class HallController extends Controller
{
    use ResolvesPublicTenant;

    public function index(string $slug): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);

        $halls = Hall::where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'name', 'sort_order']);

        return response()->json($halls);
    }

    public function tables(string $slug, Request $request): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);

        $tables = Table::where('tenant_id', $tenant->id)
            ->when($request->hall_id, fn ($q) => $q->where('hall_id', $request->hall_id))
            ->get();

        // A table's QR code is matched by table_number rather than a foreign
        // key, so a customer who taps a table here (instead of scanning its
        // physical code) needs the matching QrCode's id looked up the same way.
        $qrCodeIdsByTableNumber = QrCode::where('tenant_id', $tenant->id)
            ->where('type', QrCode::TYPE_TABLE)
            ->whereIn('table_number', $tables->pluck('table_number'))
            ->pluck('id', 'table_number');

        $tables = $tables->map(fn (Table $table) => [
            'id'           => $table->id,
            'hall_id'      => $table->hall_id,
            'table_number' => $table->table_number,
            'shape'        => $table->shape,
            'pos_x'        => $table->pos_x,
            'pos_y'        => $table->pos_y,
            'width'        => $table->width,
            'height'       => $table->height,
            'status'       => $table->status,
            'qr_code_id'   => $qrCodeIdsByTableNumber->get($table->table_number),
        ]);

        return response()->json($tables);
    }
}
