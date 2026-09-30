<?php

namespace App\Jobs;

use App\Models\AttendanceRecord;
use App\Models\Review;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\GdprExportReady;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Building the full data-portability export inline in the request (the old
 * GdprController::export()) meant a large tenant's export time was however
 * long JSON-encoding every table took, on the same worker handling the HTTP
 * request. This does the same work off the request cycle and emails a
 * signed, time-limited download link when it's ready.
 */
class GenerateGdprExport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private readonly int $tenantId,
        private readonly int $requestedByUserId,
    ) {
    }

    public function handle(): void
    {
        $tenant = Tenant::with(['plan', 'subscription'])->find($this->tenantId);
        $user   = User::find($this->requestedByUserId);

        if (! $tenant || ! $user) {
            return;
        }

        $data = [
            'exported_at' => now()->toIso8601String(),
            'tenant'      => $tenant->only([
                'id', 'name', 'slug', 'subdomain', 'custom_domain', 'status',
                'timezone', 'default_currency', 'default_locale', 'created_at',
            ]),
            'users'       => $tenant->users()->get(['id', 'name', 'email', 'phone', 'locale', 'timezone', 'last_login_at', 'created_at']),
            'branches'    => $tenant->branches()->get(),
            'menu_categories' => $tenant->menuCategories()->with('translations')->get(),
            'menu_items'  => $tenant->menuItems()->with('translations', 'prices')->get(),
            'articles'    => $tenant->articles()->with('translations')->get(),
            'employees'   => $tenant->employees()->get()->makeVisible('bank_account'),
            'attendance_records' => AttendanceRecord::where('tenant_id', $tenant->id)->get(),
            'revenues'    => $tenant->revenues()->get(),
            'expenses'    => $tenant->expenses()->get(),
            'reviews'     => Review::where('tenant_id', $tenant->id)->get(),
        ];

        $filename = Str::uuid()->toString().'.json';
        $path     = "gdpr-exports/{$tenant->id}/{$filename}";

        Storage::disk('local')->put(
            $path,
            json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        );

        $user->notify(new GdprExportReady($tenant, $filename));
    }
}
