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

class LoginController extends Controller
{
    use BuildsAuthResponse;

    public function __construct(private readonly AuditService $audit)
    {
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required'],
        ]);

        $user = User::where('email', $request->email)
                    ->with('tenant')
                    ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            return response()->json(['message' => 'Your account has been deactivated.'], 403);
        }

        // 2FA Check
        if ($user->two_factor_confirmed_at) {
            return response()->json([
                'requires_2fa' => true,
                'two_factor_token' => encrypt($user->id),
            ]);
        }

        $user->update(['last_login_at' => now()]);
        $this->audit->log('user.login', $user, actor: $user);

        return $this->issueAuthResponse($user);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->userPayload($request->user()->load('tenant', 'roles', 'permissions')));
    }
}
