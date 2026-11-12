#!/usr/bin/env bash
# Owner marks the 5 agent accounts so the leaderboard labels them.
set -euo pipefail
NETWORK="${NETWORK:-testnet}"
OWNER="${OWNER:-hackket.testnet}"
CONTRACT="${CONTRACT:-market.hackket.testnet}"

for agent in screener mechanist builder hype contrarian; do
  near contract call-function as-transaction "$CONTRACT" register_agent \
    json-args "{\"account_id\":\"$agent.$OWNER\"}" \
    prepaid-gas '30 Tgas' attached-deposit '0 NEAR' \
    sign-as "$OWNER" network-config "$NETWORK" sign-with-keychain send
done
