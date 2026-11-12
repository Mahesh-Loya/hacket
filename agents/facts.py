"""Turn one NearHunt project (+ optional README) into plain facts the personas score.
Descriptions are the builder's own claims, not verified facts."""

import re

MECHANIC_WORDS = ["auction", "bid", "burn", "mint", "stake", "escrow", "curve", "reveal", "sealed",
                  "lottery", "quorum", "slash", "bond", "reputation", "streak", "vote", "bounty",
                  "commit", "treasury", "parimutuel", "decay", "rebase", "tontine", "market"]
NEAR_DEPTH_SIGNS = [
    ("contract", ["near-sdk", "smart contract", "contract"]),
    ("intents", ["intent"]),
    ("chain_signatures", ["chain signature", "chain-signature", "mpc"]),
    ("mainnet", ["mainnet"]),
    ("standards", ["nep-141", "nep-171", "nep-245", "sub-account", "subaccount", "function call key",
                   "function-call key", "tee", "near ai"]),
]


def _first_sentence(text: str, limit: int = 140) -> str:
    text = " ".join(text.split())
    m = re.match(r"(.+?[.!?])(\s|$)", text)
    s = m.group(1) if m else text
    return s if len(s) <= limit else s[: limit - 1].rstrip() + "…"


def extract_facts(project: dict, readme: str | None) -> dict:
    description = project.get("description") or ""
    text = (description + "\n" + (readme or "")).lower()
    links = project.get("links") or []
    media = project.get("media") or []

    has_repo = bool(project.get("repository_url"))
    readme_ok = bool(readme) and len(readme) >= 500
    has_live_link = any((l.get("check") or {}).get("verdict") == "live" for l in links)
    has_video = any(m.get("type") == "video" for m in media)

    mechanic_novelty = min(5, sum(1 for w in MECHANIC_WORDS if w in text) // 2)
    near_depth = sum(1 for _, words in NEAR_DEPTH_SIGNS if any(w in text for w in words))
    polish = sum([has_repo, readme_ok, has_live_link, has_video, len(description) > 300])

    return {
        "id": project.get("submission_id"),
        "name": project.get("name") or "",
        "url": project.get("url"),
        "tracks": project.get("tracks") or [],
        "has_repo": has_repo,
        "readme_ok": readme_ok,
        "has_live_link": has_live_link,
        "has_video": has_video,
        "mentions_mainnet": "mainnet" in text,
        "mentions_intents": "intent" in text,
        "votes": project.get("votes") or 0,
        "comments": project.get("comments") or 0,
        "description_len": len(description),
        "summary": _first_sentence(description) if description else "",
        "mechanic_novelty": mechanic_novelty,
        "near_depth": near_depth,
        "polish": polish,
    }
