#!/bin/sh
# Post-deploy hook for Hostinger Business (shared hosting, no SSH needed).
# hPanel cron runs this every minute:
#   sh /home/USER/domains/restaurantgo.org/public_html/rgo-api/hostinger-cron.sh
# It only does work when something changed, so repeated runs are cheap:
#   - first run: creates .env from .env.hostinger and generates APP_KEY
#   - composer.lock changed  -> composer install --no-dev
#   - once DB_* is filled in .env: storage:link, migrate --force, and the
#     Plans + Roles/Permissions seeders whenever the app code changes
# Output goes to ~/rgo-deploy.log (outside public_html).

cd "$(dirname "$0")" || exit 1
PHP="${PHP_BIN:-php}"
COMPOSER="$(command -v composer || echo /usr/local/bin/composer)"
LOG="$HOME/rgo-deploy.log"
STAMPS=storage/app/deploy-stamps
mkdir -p "$STAMPS"
exec >>"$LOG" 2>&1

log() { echo "[$(date '+%F %T')] $*"; }

if [ ! -f .env ]; then
  cp .env.hostinger .env && chmod 600 .env && log "created .env from .env.hostinger"
fi

if ! grep -q '^APP_KEY=base64:' .env; then
  log "generating APP_KEY ($($PHP -r 'echo PHP_VERSION;'))"
  $PHP artisan key:generate --force --no-interaction
fi

lock="$(md5sum composer.lock | cut -d' ' -f1)"
if [ "$(cat "$STAMPS/composer" 2>/dev/null)" != "$lock" ]; then
  log "composer install --no-dev"
  if $PHP "$COMPOSER" install --no-dev --optimize-autoloader --no-interaction --no-progress; then
    echo "$lock" > "$STAMPS/composer"
  fi
fi

# Everything below needs the database; wait until the owner fills DB_* in .env.
grep -q '^DB_DATABASE=..*' .env && grep -q '^DB_PASSWORD=..*' .env || exit 0

[ -L public/storage ] || $PHP artisan storage:link --no-interaction

code="$(find app config database routes composer.lock -type f -exec md5sum {} + | sort | md5sum | cut -d' ' -f1)"
if [ "$(cat "$STAMPS/code" 2>/dev/null)" != "$code" ]; then
  log "code changed -> migrate + seed"
  $PHP artisan migrate --force --no-interaction \
    && $PHP artisan tinker --execute='class_exists(Database\Seeders\DatabaseSeeder::class); app(Database\Seeders\PlansSeeder::class)->run(); echo "plans seeded\n";' \
    && $PHP artisan db:seed --class=RolesPermissionsSeeder --force --no-interaction \
    && $PHP artisan optimize:clear \
    && echo "$code" > "$STAMPS/code" \
    && log "done"
fi
