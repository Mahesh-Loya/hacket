"""Print the live leaderboard from the contract (read-only, no keys):  python -m agents.leaderboard"""

import base64
import json
import urllib.request

from agents.config import CONTRACT_ID, NETWORK

RPC = {"testnet": "https://test.rpc.fastnear.com", "mainnet": "https://free.rpc.fastnear.com"}[NETWORK]


def view(method: str, args: dict) -> object:
    body = {"jsonrpc": "2.0", "id": "market", "method": "query",
            "params": {"request_type": "call_function", "finality": "final", "account_id": CONTRACT_ID,
                       "method_name": method, "args_base64": base64.b64encode(json.dumps(args).encode()).decode()}}
    req = urllib.request.Request(RPC, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        out = json.loads(resp.read().decode("utf-8"))
    return json.loads(bytes(out["result"]["result"]).decode("utf-8"))


def format_rows(rows: list[dict]) -> str:
    return "\n".join(
        f"{i}. {r['account_id']}{' (AI)' if r['is_agent'] else ''}  {r['score']}" for i, r in enumerate(rows, 1)
    )


if __name__ == "__main__":
    config = view("get_config", {})
    print(f"{CONTRACT_ID} on {NETWORK}: {config['player_count']} players, results entered: {config['has_results']}\n")
    print(format_rows(view("get_leaderboard", {"from_index": 0, "limit": 50})))
