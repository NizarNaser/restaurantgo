<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Auth\Concerns\BuildsAuthResponse;
use App\Http\Controllers\Controller;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    use BuildsAuthResponse;

    public function __construct(private readonly AuditService $audit)
    {
    }

    /** Requires the current password, since the email doubles as the login identifier. */
    public function updateEmail(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'email'    => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['required'],
        ]);

        if (! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => ['Incorrect password.']]);
        }

        $user->update(['email' => $data['email']]);
        $this->audit->log('user.email_changed', $user, actor: $user);

        return response()->json(['user' => $this->userPayload($user)]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required'],
            'password'         => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => ['Incorrect password.']]);
        }

        $user->update(['password' => $data['password']]);
        $this->audit->log('user.password_changed', $user, actor: $user);

        return response()->json(['message' => 'Password updated.']);
    }
}
