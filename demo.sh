#!/usr/bin/env bash
# One command to check everything works. Needs: Rust (cargo), Python 3.10+, Node 18+.
# No wallet, API key or NEAR account required.
set -euo pipefail
cd "$(dirname "$0")"

echo "== 1/5 Contract unit tests (lock, validation, scoring, leaderboard) =="
(cd contract && cargo test -q)

echo "== 2/5 Agent tests =="
python -m pip install -q pytest >/dev/null 2>&1 || true
python -m pytest tests -q

echo "== 3/5 Run the 5 agents offline on the committed snapshot (data/) =="
python -m agents.run

echo "== 4/5 Website tests + build =="
(cd web && npm ci --silent && npx vitest run && npm run build >/dev/null && echo "web build ok: web/dist")

echo "== 5/5 Live leaderboard from the deployed contract (read-only) =="
python -m agents.leaderboard || echo "(could not reach NEAR testnet RPC; steps 1-4 do not need it)"
