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
# Cron's default `php` on Hostinger is older than the site's PHP (8.4 is
# required by Laravel 13), so pick the 8.4 CLI explicitly.
PHP="${PHP_BIN:-}"
if [ -z "$PHP" ]; then
  for p in /opt/alt/php84/usr/bin/php /usr/bin/php8.4 /usr/local/bin/php8.4 /opt/cpanel/ea-php84/root/usr/bin/php php; do
    if command -v "$p" >/dev/null 2>&1; then PHP="$p"; break; fi
  done
fi
COMPOSER="$(command -v composer || echo /usr/local/bin/composer)"
LOG="$HOME/rgo-deploy.log"
STAMPS=storage/app/deploy-stamps
mkdir -p "$STAMPS"
exec >>"$LOG" 2>&1

log() { echo "[$(date '+%F %T')] $*"; }

phpver="$($PHP -r 'echo PHP_VERSION;' 2>/dev/null)"
case "$phpver" in
  8.4*|8.5*|9.*) ;;
  *) log "PHP 8.4+ CLI not found (got '$PHP' = '$phpver'); candidates: $(ls -d /opt/alt/php8* /usr/bin/php8* 2>/dev/null | tr '\n' ' ')"; exit 1 ;;
esac

if [ ! -f .env ]; then
  cp .env.hostinger .env && chmod 600 .env && log "created .env from .env.hostinger"
fi

if ! grep -q '^APP_KEY=base64:' .env; then
  log "generating APP_KEY (PHP $phpver)"
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
