#!/usr/bin/env bash
# Stop the local dev stack started by dev.sh (API server, queue worker,
# dashboard + web Vite servers) — including instances started in the
# background (nohup) that have no terminal to Ctrl+C.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
PROJECT_DIR="$(pwd)"

stopped_any=false

echo "Stopping dev servers on ports 8000, 5173, 5174..."
for port in 8000 5173 5174; do
  pids=$(lsof -ti:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  - port $port: killing PID(s) $pids"
    kill $pids 2>/dev/null || true
    stopped_any=true
  fi
done

# The queue worker binds no port, and dev.sh's own `cd api && ...` means the
# project path never shows up in the command line for pgrep -f to match — so
# instead find candidates by command name, then confirm it's actually this
# project's by checking the process's working directory.
kill_if_in_project() {
  local pattern="$1" expected_cwd="$2"
  for pid in $(pgrep -f "$pattern" 2>/dev/null || true); do
    if [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" = "$expected_cwd" ]; then
      echo "  - $pattern: killing PID $pid"
      kill "$pid" 2>/dev/null || true
      stopped_any=true
    fi
  done
}

kill_if_in_project "artisan queue:work" "$PROJECT_DIR/api"
kill_if_in_project "dev\.sh" "$PROJECT_DIR"

sleep 1

if $stopped_any; then
  echo "Done."
else
  echo "Nothing was running."
fi
