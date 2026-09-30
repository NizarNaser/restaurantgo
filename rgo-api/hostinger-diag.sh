#!/bin/sh
# Read-only diagnostics for Hostinger (view via hPanel -> Cron Jobs -> View Output).
# Prints which .env keys are filled (never their values) and the latest errors.
cd "$(dirname "$0")" || exit 1
echo "== filled .env keys"
for k in APP_KEY DB_DATABASE DB_PASSWORD MAIL_HOST MAIL_USERNAME MAIL_PASSWORD STRIPE_KEY STRIPE_SECRET OPENAI_API_KEY; do
  if grep -q "^$k=..*" .env 2>/dev/null; then echo "$k: set"; else echo "$k: EMPTY"; fi
done
echo "== last deploy log"
tail -5 "$HOME/rgo-deploy.log" 2>&1
echo "== last errors (laravel.log)"
grep -a '\.ERROR' storage/logs/laravel.log 2>/dev/null | tail -4 | cut -c1-900
