#!/usr/bin/env bash
# CORDON — stop both demo servers (frees ports 8000 and 3000).
for p in 8000 3000; do
  pids=$(lsof -ti tcp:$p 2>/dev/null || true)
  if [ -n "$pids" ]; then echo "stopping port $p (pids: $pids)"; kill -9 $pids 2>/dev/null || true; fi
done
echo "✓ stopped"
