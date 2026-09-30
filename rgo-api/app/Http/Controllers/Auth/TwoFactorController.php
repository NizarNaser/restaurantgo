<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Auth\Concerns\BuildsAuthResponse;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;

/**
 * Completes the 2FA feature that previously only existed as unusable pieces:
 * `users.two_factor_secret`/`two_factor_confirmed_at` columns and a branch in
 * LoginController that returned `requires_2fa` with no endpoint able to act on
 * it. Enrollment issues a secret the authenticator app scans (via the QR the
 * frontend renders from `otpauth_url`, using the same qrcode.react library it
 * already ships); nothing takes effect at login until `confirm()` proves the
 * app was set up correctly.
 */
class TwoFactorController extends Controller
{
    use BuildsAuthResponse;

    public function __construct(
        private readonly Google2FA $google2fa,
        private readonly AuditService $audit,
    ) {
    }

    public function enroll(Request $request): JsonResponse
    {
        $user   = $request->user();
        $secret = $this->google2fa->generateSecretKey();

        $user->update(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => null]);

        return response()->json([
            'secret'      => $secret,
            'otpauth_url' => $this->google2fa->getQRCodeUrl(config('app.name', 'RestaurantGo'), $user->email, $secret),
        ]);
    }

    public function confirm(Request $request): JsonResponse
    {
        $request->validate(['code' => ['required', 'string']]);

        $user = $request->user();
        abort_if(! $user->two_factor_secret, 422, 'Start enrollment first.');

        if (! $this->google2fa->verifyKey($user->two_factor_secret, $request->code)) {
            throw ValidationException::withMessages(['code' => ['That code is incorrect or expired.']]);
        }

        $user->update(['two_factor_confirmed_at' => now()]);
        $this->audit->log('user.2fa_enabled', $user, actor: $user);

        return response()->json(['message' => 'Two-factor authentication enabled.']);
    }

    /** Requires the current password, since turning this off weakens the account. */
    public function disable(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required']]);

        $user = $request->user();

        if (! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages(['password' => ['Incorrect password.']]);
        }

        $user->update(['two_factor_secret' => null, 'two_factor_confirmed_at' => null]);
        $this->audit->log('user.2fa_disabled', $user, actor: $user);

        return response()->json(['message' => 'Two-factor authentication disabled.']);
    }

    /** The counterpart to LoginController::login's `requires_2fa` response. */
    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'two_factor_token' => ['required', 'string'],
            'code'              => ['required', 'string'],
        ]);

        $user = $this->resolveTokenUser($request->two_factor_token);

        if (! $this->google2fa->verifyKey($user->two_factor_secret, $request->code)) {
            throw ValidationException::withMessages(['code' => ['That code is incorrect or expired.']]);
        }

        $user->update(['last_login_at' => now()]);
        $this->audit->log('user.login', $user, actor: $user);

        return $this->issueAuthResponse($user->load('tenant'));
    }

    private function resolveTokenUser(string $token): User
    {
        try {
            $userId = decrypt($token);
        } catch (\Throwable) {
            $userId = null;
        }

        $user = $userId ? User::find($userId) : null;

        if (! $user || ! $user->two_factor_confirmed_at) {
            throw ValidationException::withMessages([
                'two_factor_token' => ['This session has expired. Please log in again.'],
            ]);
        }

        return $user;
    }
}
