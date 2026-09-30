<?php

namespace App\Services;

use App\Models\StaffCard;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Resolves the staff member behind a manually-typed card access code —
 * shared by StaffCardController::verify() (the phone/tablet app's own login)
 * and the discount-approval flow (a different owner/manager confirming
 * in person on a shared device).
 */
class StaffAccessService
{
    public function resolveByAccessCode(string $accessCode): ?User
    {
        $card = StaffCard::where('tenant_id', app('tenant')->id)
            ->where('is_active', true)
            ->with('user')
            ->get()
            ->first(fn (StaffCard $c) => Hash::check($accessCode, $c->access_code));

        if (! $card || ! $card->user->is_active) {
            return null;
        }

        return $card->user;
    }

    /**
     * Step-up credential check shared by every admin-approval-gated action
     * (discount approval/redemption, table transfer): either the current
     * session's own password, or a different owner/manager's access code
     * (the shared-terminal case).
     */
    public function resolveApprover(Request $request): ?User
    {
        if ($request->filled('password')) {
            $user = $request->user();

            return Hash::check($request->string('password'), $user->password) ? $user : null;
        }

        if ($request->filled('access_code')) {
            return $this->resolveByAccessCode($request->string('access_code'));
        }

        return null;
    }
}
