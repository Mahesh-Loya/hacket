#!/usr/bin/env bash
# Build and deploy the contract to testnet, then call `new` once.
# Re-running redeploys the code; the init call will fail on an
# already-initialised account, which is expected (state is kept).
set -euo pipefail
NETWORK="${NETWORK:-testnet}"
OWNER="${OWNER:-hackket.testnet}"
CONTRACT="${CONTRACT:-market.hackket.testnet}"
LOCK_AT_NS="1794787200000000000" # 2026-11-16 00:00:00 UTC

cd "$(dirname "$0")/../contract"
cargo near build non-reproducible-wasm --no-abi
near contract deploy "$CONTRACT" use-file target/near/hackathon_market.wasm \
  with-init-call new json-args "{\"owner_id\":\"$OWNER\",\"lock_at_ns\":\"$LOCK_AT_NS\"}" \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config "$NETWORK" sign-with-keychain send
