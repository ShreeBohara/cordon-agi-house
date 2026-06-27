#!/usr/bin/env bash
# CORDON — one-command demo launcher.
# Boots the control plane (FastAPI) + dashboard (Next.js), waits for both to be
# healthy, prints the URL. Ctrl+C stops both cleanly. Re-running frees stale ports.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BACKEND_PORT=8000
DASHBOARD_PORT=3000

echo "▶ CORDON demo launcher"

# 0. free stale ports so we never fight a dead server
for p in $BACKEND_PORT $DASHBOARD_PORT; do
  pids=$(lsof -ti tcp:$p 2>/dev/null || true)
  if [ -n "$pids" ]; then echo "  freeing port $p"; kill -9 $pids 2>/dev/null || true; fi
done

# 1. control plane
echo "  starting control plane  → port $BACKEND_PORT"
.venv/bin/python -m uvicorn control_plane.main:app --app-dir "$ROOT" --port "$BACKEND_PORT" \
  > /tmp/cordon-backend.log 2>&1 &
BACKEND_PID=$!

# 2. dashboard
echo "  starting dashboard      → port $DASHBOARD_PORT"
( cd dashboard && npm run dev > /tmp/cordon-dashboard.log 2>&1 ) &
DASHBOARD_PID=$!

cleanup() {
  echo ""; echo "▶ stopping…"
  kill "$BACKEND_PID" "$DASHBOARD_PID" 2>/dev/null || true
  for p in $BACKEND_PORT $DASHBOARD_PORT; do
    pids=$(lsof -ti tcp:$p 2>/dev/null || true)
    if [ -n "$pids" ]; then kill -9 $pids 2>/dev/null || true; fi
  done
  exit 0
}
trap cleanup INT TERM

# 3. wait for the backend health endpoint
printf "  waiting for control plane"
for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then OK_BE=1; break; fi
  printf "."; sleep 0.5
done
echo ""
if [ "${OK_BE:-}" != "1" ]; then echo "  ✗ control plane failed — see /tmp/cordon-backend.log"; cleanup; fi
echo "  ✓ control plane up — $(curl -s "http://127.0.0.1:$BACKEND_PORT/health")"

# 4. wait for the dashboard
printf "  waiting for dashboard"
for _ in $(seq 1 80); do
  if curl -sf "http://127.0.0.1:$DASHBOARD_PORT" >/dev/null 2>&1; then OK_FE=1; break; fi
  printf "."; sleep 0.5
done
echo ""
if [ "${OK_FE:-}" != "1" ]; then echo "  ✗ dashboard failed — see /tmp/cordon-dashboard.log"; cleanup; fi
echo "  ✓ dashboard up"

cat <<EOF

  ┌────────────────────────────────────────────────┐
   CORDON is live
   Dashboard :  http://localhost:$DASHBOARD_PORT
   Backend   :  http://localhost:$BACKEND_PORT/health
  └────────────────────────────────────────────────┘

  Demo:  open the dashboard → flip CORDON OFF (breach) then ON (contained),
         or click RUN LIVE for the real OpenAI swarm.
  Logs:  /tmp/cordon-backend.log · /tmp/cordon-dashboard.log
  Stop:  Ctrl+C (or ./stop.sh)

EOF

wait
