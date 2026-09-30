#!/usr/bin/env bash
# Start the full stack natively (no Docker) for local development, reachable
# both on this machine and from a phone on the same WiFi:
#   - Laravel API      -> http://localhost:8000        / http://<LAN-IP>:8000
#   - dashboard (Vite) -> http://localhost:5173         / http://<LAN-IP>:5173
#   - web (Vite)       -> http://localhost:5174         / http://<LAN-IP>:5174
#
# Requires: php, composer deps installed in api/, node deps installed in
# dashboard/ and web/ (npm install), and api/.env already configured
# (APP_KEY set, DB_* pointing at a running local MySQL/SQLite, etc).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

pids=()
cleanup() {
  echo ""
  echo "Stopping..."
  kill "${pids[@]}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd api && PHP_INI_SCAN_DIR=":$(pwd)/docker" php artisan serve --host=0.0.0.0 --port=8000) &
pids+=($!)

# Processes queued jobs (e.g. AI menu/blog translation into a newly-added
# language — see TranslateTenantContentJob) — without this they just sit in
# the `jobs` table and never run.
(cd api && PHP_INI_SCAN_DIR=":$(pwd)/docker" php artisan queue:work --sleep=1 --tries=1) &
pids+=($!)

(cd dashboard && npm run dev -- --host 0.0.0.0 --port=5173) &
pids+=($!)

(cd web && npm run dev -- --host 0.0.0.0 --port=5174) &
pids+=($!)

echo ""
echo "=============================================================="
echo " Local:"
echo "   dashboard -> http://localhost:5173"
echo "   web       -> http://localhost:5174"
if [ -n "$LAN_IP" ]; then
  echo ""
  echo " On your phone (same WiFi):"
  echo "   dashboard -> http://$LAN_IP:5173"
  echo "   web       -> http://$LAN_IP:5174"
else
  echo ""
  echo " Could not detect a LAN IP automatically — run 'hostname -I' and"
  echo " open http://<that-ip>:5173 (dashboard) or :5174 (web) on your phone."
fi
echo "=============================================================="
echo ""

wait
