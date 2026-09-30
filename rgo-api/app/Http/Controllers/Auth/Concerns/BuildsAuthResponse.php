<?php

namespace App\Http\Controllers\Auth\Concerns;

use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Shared by every controller that can be the final step of a login (the plain
 * password check, and the 2FA code verification that follows it) so both
 * produce an identical token + user + tenant payload.
 */
trait BuildsAuthResponse
{
    private function issueAuthResponse(User $user): JsonResponse
    {
        $token = $user->createToken('auth_token', $this->getAbilities($user))->plainTextToken;

        return response()->json([
            'token'  => $token,
            'user'   => $this->userPayload($user),
            'tenant' => $user->tenant?->only('id', 'name', 'subdomain', 'custom_domain', 'status', 'default_locale', 'default_currency'),
        ]);
    }

    private function userPayload(User $user): array
    {
        return [
            'id'          => $user->id,
            'name'        => $user->name,
            'email'       => $user->email,
            'avatar'      => $user->avatar,
            'locale'      => $user->locale,
            'timezone'    => $user->timezone,
            'roles'       => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
            'tenant_id'   => $user->tenant_id,
        ];
    }

    private function getAbilities(User $user): array
    {
        return $user->getAllPermissions()->pluck('name')->toArray();
    }
}
