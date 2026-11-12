"""Optional: let a language model read each project once and refine the facts.
Set NEARAI_API_KEY (NEAR AI Cloud, OpenAI-compatible) or ANTHROPIC_API_KEY.
Any failure leaves the rule-based facts unchanged."""

import json
import os
import pathlib
import urllib.request
from concurrent.futures import ThreadPoolExecutor

README_LIMIT = 6000
NEARAI_URL = os.environ.get("NEARAI_URL", "https://cloud-api.near.ai/v1/chat/completions")
NEARAI_MODEL = os.environ.get("NEARAI_MODEL", "openai/gpt-oss-120b")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-5-5")

PROMPT = """You rate one NEAR Hackathon entry. The description and README are the builder's own claims, not verified facts.
Reply with JSON only: {{"summary": "<one neutral sentence, max 140 chars>", "mechanic_novelty": 0-5, "near_depth": 0-5, "polish": 0-5}}
- mechanic_novelty: how original and well-defined the rules/mechanism are
- near_depth: how concretely it uses NEAR (contracts, Intents, chain signatures, mainnet, TEE)
- polish: how ready it looks for a judge to run (clear README steps, demo, live link)

Name: {name}
Tracks: {tracks}
Description: {description}
README (truncated):
{readme}"""


def _post(url: str, headers: dict, body: dict) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _complete(prompt: str) -> str:
    if key := os.environ.get("NEARAI_API_KEY"):
        out = _post(NEARAI_URL, {"Authorization": f"Bearer {key}"},
                    {"model": NEARAI_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 300})
        return out["choices"][0]["message"]["content"]
    key = os.environ["ANTHROPIC_API_KEY"]
    out = _post("https://api.anthropic.com/v1/messages", {"x-api-key": key, "anthropic-version": "2023-06-01"},
                {"model": ANTHROPIC_MODEL, "max_tokens": 300, "messages": [{"role": "user", "content": prompt}]})
    return out["content"][0]["text"]


def _clamp(v) -> int:
    return max(0, min(5, int(v)))


def enrich(facts: dict, project: dict, readme: str | None) -> dict:
    prompt = PROMPT.format(name=project.get("name") or "", tracks=", ".join(project.get("tracks") or []),
                           description=project.get("description") or "", readme=(readme or "")[:README_LIMIT])
    try:
        text = _complete(prompt)
        data = json.loads(text[text.index("{"): text.rindex("}") + 1])
        out = dict(facts)
        if isinstance(data.get("summary"), str) and data["summary"].strip():
            out["summary"] = data["summary"].strip()[:140]
        for k in ("mechanic_novelty", "near_depth", "polish"):
            if k in data:
                out[k] = _clamp(data[k])
        return out
    except Exception as e:  # noqa: BLE001 - any failure keeps the rule-based facts
        print(f"LLM skipped for {facts.get('name')!r}: {e}")
        return facts


def enrich_all(facts: list[dict], projects: list[dict], readmes: list[str | None],
               cache_path: str = "data/llm_cache.json") -> list[dict]:
    """Enrich every project, caching by id + updated_at so re-runs are free."""
    if not (os.environ.get("NEARAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")):
        print("--llm needs NEARAI_API_KEY or ANTHROPIC_API_KEY; using rule-based facts.")
        return facts
    path = pathlib.Path(cache_path)
    cache = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    keys = [f"{p.get('submission_id')}@{p.get('updated_at')}" for p in projects]

    def one(i: int) -> dict:
        if keys[i] in cache:
            return {**facts[i], **cache[keys[i]]}
        return enrich(facts[i], projects[i], readmes[i])

    with ThreadPoolExecutor(max_workers=4) as pool:
        out = list(pool.map(one, range(len(facts))))
    for k, before, after in zip(keys, facts, out):
        if after is not before:  # enrich() returns the original dict on failure; retry those next run
            cache[k] = {x: after[x] for x in ("summary", "mechanic_novelty", "near_depth", "polish")}
    path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    return out
