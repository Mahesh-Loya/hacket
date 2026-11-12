"""Send each agent's picks to the contract, signed by the agent's own account
(keys come from the local NEAR CLI keychain, never from this repo)."""

import json
import shlex
import shutil
import subprocess

from agents.config import CONTRACT_ID, NETWORK, OWNER


def build_command(persona: str, picks: list[dict]) -> list[str]:
    near = shutil.which("near") or "near"
    return [
        near, "contract", "call-function", "as-transaction", CONTRACT_ID, "submit_picks",
        "json-args", json.dumps({"picks": picks}),
        "prepaid-gas", "100 Tgas", "attached-deposit", "0.05 NEAR",
        "sign-as", f"{persona}.{OWNER}", "network-config", NETWORK, "sign-with-keychain", "send",
    ]


def publish_all(agents_json: dict, dry_run: bool) -> None:
    for persona, out in agents_json.items():
        argv = build_command(persona, out["picks"])
        if dry_run:
            print(shlex.join(argv))
            continue
        result = subprocess.run(argv, capture_output=True, text=True, encoding="utf-8", errors="replace")
        ok = result.returncode == 0
        print(f"{persona}.{OWNER}: {'published' if ok else 'FAILED'}")
        if not ok:
            print(result.stderr[-2000:])
