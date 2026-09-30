# Authenticating requests

To authenticate requests, include an **`Authorization`** header with the value **`"Bearer {YOUR_SANCTUM_TOKEN}"`**.

All authenticated endpoints are marked with a `requires authentication` badge in the documentation below.

Log in via `POST /api/auth/login` to receive a Sanctum token, then send it as `Authorization: Bearer {token}`.
