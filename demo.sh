#!/usr/bin/env bash
# One command to check everything works. Needs: Rust (cargo), Python 3.10+ with pytest, Node 22.12+.
# No wallet, API key or NEAR account required.
set -euo pipefail
cd "$(dirname "$0")"
# First python that has pytest (Windows' "python3" can be a different install).
PY="${PYTHON:-}"
if [ -z "$PY" ]; then
  for c in python3 python; do
    if command -v "$c" >/dev/null && "$c" -m pytest --version >/dev/null 2>&1; then PY="$c"; break; fi
  done
  PY="${PY:-$(command -v python3 || command -v python)}"
fi

echo "== 1/5 Contract unit tests (lock, validation, scoring, leaderboard) =="
(cd contract && cargo test -q)

echo "== 2/5 Agent tests =="
"$PY" -m pytest --version >/dev/null 2>&1 || { echo "pytest missing: run  $PY -m pip install pytest  (or use a venv)"; exit 1; }
"$PY" -m pytest tests -q

echo "== 3/5 Run the 5 agents offline on the committed snapshot (data/) =="
"$PY" -m agents.run

echo "== 4/5 Website tests + build =="
(cd web && npm ci --silent && npx vitest run && npm run build >/dev/null && echo "web build ok: web/dist")

echo "== 5/5 Live leaderboard from the deployed contract (read-only) =="
"$PY" -m agents.leaderboard || echo "(could not reach NEAR testnet RPC; steps 1-4 do not need it)"
