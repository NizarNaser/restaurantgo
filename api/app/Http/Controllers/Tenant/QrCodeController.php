<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\QrCode;
use App\Services\SeoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class QrCodeController extends Controller
{
    public function __construct(private readonly SeoService $seo)
    {
    }

    public function index(): JsonResponse
    {
        $codes = QrCode::where('tenant_id', app('tenant')->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json($codes);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type'              => ['required', Rule::in([QrCode::TYPE_MENU, QrCode::TYPE_ITEM, QrCode::TYPE_TABLE])],
            'target_url'        => ['required_unless:type,table', 'nullable', 'url', 'max:2048'],
            'branch_id'         => ['required_if:type,table', 'nullable', 'integer', 'exists:branches,id'],
            'menu_category_id'  => ['nullable', 'integer', 'exists:menu_categories,id'],
            'table_number'      => ['required_if:type,table', 'nullable', 'string', 'max:50'],
        ]);

        $tenant = app('tenant');
        // target_url is a NOT NULL column but is unknowable for a table code
        // until its own row (and id) exists — placeholder here, patched below.
        $validated['target_url'] ??= '';
        $qrCode = QrCode::create([...$validated, 'tenant_id' => $tenant->id]);

        // A table code's target is always its own scan-and-order URL — it
        // can't be known until the row (and its id) exists, so patch it
        // in as a second step rather than requiring the caller to supply it.
        if ($qrCode->type === QrCode::TYPE_TABLE) {
            $qrCode->update([
                'target_url' => $this->seo->tenantBaseUrl($tenant) . '?qr=' . $qrCode->id,
            ]);
        }

        return response()->json($qrCode, 201);
    }

    public function destroy(QrCode $qrCode): JsonResponse
    {
        abort_if((int) $qrCode->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');

        $qrCode->delete();

        return response()->json(['message' => 'QR code deleted.']);
    }
}
