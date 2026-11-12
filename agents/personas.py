"""Five judge personas. Each scores a project's facts its own way and explains
itself in one short, factual line."""

from typing import Callable

from agents.config import OWN_PROJECT_NAME, TRACKS


def _yn(flag: bool) -> str:
    return "yes" if flag else "no"


def screener(f: dict) -> tuple[float, str]:
    s = 2.0 * f["has_repo"] + 2.0 * f["readme_ok"] + 1.5 * f["has_live_link"] + 1.0 * f["has_video"] + 0.5 * f["polish"]
    return s, (f"Can a judge run it? repo {_yn(f['has_repo'])}, README {_yn(f['readme_ok'])}, "
               f"live link {_yn(f['has_live_link'])}, video {_yn(f['has_video'])}.")


def mechanist(f: dict) -> tuple[float, str]:
    s = 2.0 * f["mechanic_novelty"] + 0.3 * f["polish"] + 0.5 * f["has_repo"]
    return s, f"Mechanism signals {f['mechanic_novelty']}/5: I look for rules that make the game, not the chart."


def builder(f: dict) -> tuple[float, str]:
    s = 2.0 * f["near_depth"] + 1.5 * f["mentions_mainnet"] + 1.0 * f["mentions_intents"] + 0.5 * f["has_repo"]
    return s, (f"NEAR depth {f['near_depth']}/5, mainnet {_yn(f['mentions_mainnet'])}, "
               f"Intents {_yn(f['mentions_intents'])}.")


def hype(f: dict) -> tuple[float, str]:
    s = 2.0 * f["votes"] + 1.0 * f["comments"]
    return float(s), f"The crowd speaks: {f['votes']} votes and {f['comments']} comments on NearHunt."


def contrarian(f: dict) -> tuple[float, str]:
    quality = f["polish"] + f["near_depth"] + f["mechanic_novelty"]
    s = quality - 1.5 * f["votes"] - 0.5 * f["comments"]
    return float(s), f"Quality signals {quality}/15 with only {f['votes']} votes: the underdog I back."


PERSONAS: dict[str, Callable[[dict], tuple[float, str]]] = {
    "screener": screener,
    "mechanist": mechanist,
    "builder": builder,
    "hype": hype,
    "contrarian": contrarian,
}


def pick_all(facts: list[dict], persona: str, exclude_ids: set[str]) -> dict:
    """Top 3 per track among projects tagged with it, plus the overall #1 as `grand`.
    Ties break by name so runs are repeatable."""
    fn = PERSONAS[persona]
    pool = [f for f in facts if f["id"] not in exclude_ids and f["name"] != OWN_PROJECT_NAME]
    scored = {f["id"]: fn(f) for f in pool}
    ranked = sorted(pool, key=lambda f: (-scored[f["id"]][0], f["name"].lower(), f["id"]))

    picks = []
    for track in TRACKS:
        ids = [f["id"] for f in ranked if track in f["tracks"]][:3]
        if ids:
            picks.append({"category": track, "ids": ids})
    if ranked:
        picks.append({"category": "grand", "ids": [ranked[0]["id"]]})

    return {
        "picks": picks,
        "reasons": {i: r for i, (_, r) in scored.items()},
        "scores": {i: round(s, 2) for i, (s, _) in scored.items()},
    }
