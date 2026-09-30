<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateGdprExport;
use App\Models\Employee;
use App\Models\Review;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * GDPR data portability (Art. 20) and erasure (Art. 17) for a tenant's own data.
 *
 * Erasure anonymizes personally identifiable fields on users/employees/reviews
 * rather than hard-deleting the tenant's operational records — financial and
 * payroll rows are retained (without PII) to satisfy standard accounting/tax
 * retention obligations, which is the common lawful-basis exception to erasure.
 */
class GdprController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    /**
     * Building the export inline used to block the request for however long
     * JSON-encoding every table took; it now runs as a queued job
     * (GenerateGdprExport) and emails a signed download link when ready.
     */
    public function export(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $this->audit->log('tenant.gdpr_export_requested', $tenant, ['new' => ['requested_by' => $request->user()->id]]);

        GenerateGdprExport::dispatch($tenant->id, $request->user()->id);

        return response()->json([
            'message' => "We're preparing your data export. You'll receive an email with a secure download link shortly.",
        ], 202);
    }

    /**
     * The link GdprExportReady's email points at — protected by Laravel's
     * signed-URL verification rather than auth, since it's opened from an
     * email client that has no Sanctum token to send.
     */
    public function downloadExport(Tenant $tenant, string $filename): StreamedResponse
    {
        $path = "gdpr-exports/{$tenant->id}/{$filename}";

        abort_unless(Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->download($path, "gdpr-export-{$tenant->slug}.json");
    }

    public function requestErasure(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $request->validate([
            // Typed confirmation guards against a single misclick triggering
            // an irreversible anonymization of every user/employee/review.
            'confirm_slug' => ['required', 'string'],
        ]);

        abort_if($request->input('confirm_slug') !== $tenant->slug, 422, 'Confirmation text does not match the tenant slug.');
        abort_unless($request->user()->isTenantOwner(), 403, 'Only the tenant owner can request data erasure.');

        // Recorded before anonymizing, so the trail still shows who acted and when.
        $this->audit->log('tenant.gdpr_erasure_requested', $tenant, [
            'new' => ['requested_by' => $request->user()->id, 'requested_at' => now()->toIso8601String()],
        ]);

        DB::transaction(function () use ($tenant) {
            $tenant->users()->get()->each(function (User $user) use ($tenant) {
                $user->tokens()->delete();
                $user->update([
                    'name'               => 'Deleted User',
                    'email'              => 'deleted-'.Str::random(10)."@{$tenant->slug}.invalid",
                    'phone'              => null,
                    'avatar'             => null,
                    'two_factor_secret'  => null,
                    'is_active'          => false,
                ]);
            });

            Employee::where('tenant_id', $tenant->id)->get()->each(fn (Employee $employee) => $employee->update([
                'name'         => 'Deleted Employee',
                'national_id'  => null,
                'phone'        => null,
                'email'        => null,
                'bank_account' => null,
                'notes'        => null,
            ]));

            Review::where('tenant_id', $tenant->id)->update([
                'customer_name'  => 'Anonymous',
                'customer_email' => null,
            ]);

            $tenant->update(['status' => 'cancelled']);
            $tenant->delete();
        });

        return response()->json([
            'message' => 'Personal data has been anonymized and the tenant deactivated. Financial records were retained without personal identifiers for accounting compliance.',
        ]);
    }
}
