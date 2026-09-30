#!/bin/sh
set -e

# Two ways this container gets its config: a bind-mounted .env (local
# docker-compose — persists a generated key across recreates instead of
# throwing away a new one each time), or real environment variables with no
# .env file at all (Railway and most PaaS — APP_KEY is already correct,
# and `key:generate` would crash trying to write a file that isn't there).
if [ -z "$APP_KEY" ] && [ -f .env ] && ! grep -q '^APP_KEY=.\+' .env; then
    php artisan key:generate --force
fi

# Safe to run on every boot: Laravel skips migrations that already ran.
php artisan migrate --force

# Fresh container filesystem each rebuild means the public/storage symlink
# (needed to serve uploaded menu item images etc.) has to be recreated too —
# without it, uploads still save to disk but their public URL 404s.
[ -L public/storage ] || php artisan storage:link

exec "$@"
