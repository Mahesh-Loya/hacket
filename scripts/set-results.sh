#!/usr/bin/env bash
# After the official announcement: owner enters winners from data/results.json
# ([{"category":"swarms","ids":["<id 1st>","<id 2nd>","<id 3rd>"]}, ..., {"category":"grand","ids":["<id>"]}]).
# Ids are NearHunt submission ids. Safe to re-run to correct a mistake.
set -euo pipefail
NETWORK="${NETWORK:-testnet}"
OWNER="${OWNER:-hackket.testnet}"
CONTRACT="${CONTRACT:-market.hackket.testnet}"
cd "$(dirname "$0")/.."

RESULTS=$(python -c "import json; print(json.dumps({'results': json.load(open('data/results.json', encoding='utf-8'))}))")
near contract call-function as-transaction "$CONTRACT" set_results json-args "$RESULTS" \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  sign-as "$OWNER" network-config "$NETWORK" sign-with-keychain send
python -m agents.leaderboard
