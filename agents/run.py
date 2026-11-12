"""Run the five agents.

    python -m agents.run              offline: committed data/ snapshot, no keys
    python -m agents.run --refresh    re-fetch NearHunt + GitHub READMEs
    python -m agents.run --llm        let an LLM refine facts (needs NEARAI_API_KEY or ANTHROPIC_API_KEY)
    python -m agents.run --publish    send each agent's picks to the contract (NEAR CLI keychain)
"""

import argparse
import json
import pathlib
from concurrent.futures import ThreadPoolExecutor

from agents.config import OWN_PROJECT_IDS, PERSONA_NAMES
from agents.facts import extract_facts
from agents.fetch import fetch_projects, fetch_readme
from agents.personas import pick_all

DATA = pathlib.Path("data")


def build_facts(projects: list[dict], refresh: bool, use_llm: bool) -> list[dict]:
    facts_path = DATA / "facts.json"
    if not refresh and facts_path.exists():
        cached = {f["id"]: f for f in json.loads(facts_path.read_text(encoding="utf-8"))}
        if all(p["submission_id"] in cached for p in projects):
            return [cached[p["submission_id"]] for p in projects]

    if refresh:
        with ThreadPoolExecutor(max_workers=8) as pool:
            readmes = list(pool.map(lambda p: fetch_readme(p.get("repository_url")), projects))
    else:
        readmes = [None] * len(projects)

    facts = [extract_facts(p, r) for p, r in zip(projects, readmes)]
    if use_llm:
        from agents.llm import enrich_all
        facts = enrich_all(facts, projects, readmes)
    return facts


def main(argv: list[str] | None = None) -> dict:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--llm", action="store_true")
    ap.add_argument("--publish", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="with --publish: print commands only")
    args = ap.parse_args(argv)

    projects = fetch_projects(str(DATA / "projects.json"), refresh=args.refresh)
    facts = build_facts(projects, args.refresh, args.llm)
    DATA.mkdir(exist_ok=True)
    (DATA / "facts.json").write_text(json.dumps(facts, ensure_ascii=False, indent=1), encoding="utf-8")

    agents = {name: pick_all(facts, name, OWN_PROJECT_IDS) for name in PERSONA_NAMES}
    (DATA / "agents.json").write_text(json.dumps(agents, ensure_ascii=False), encoding="utf-8")

    names = {f["id"]: f["name"] for f in facts}
    print(f"{len(facts)} projects scored by {len(agents)} agents\n")
    print(f"{'agent':<12} grand prize pick")
    for name, out in agents.items():
        grand = next(p for p in out["picks"] if p["category"] == "grand")["ids"][0]
        print(f"{name:<12} {names[grand]}")

    if args.publish:
        from agents.publish import publish_all
        publish_all(agents, dry_run=args.dry_run)
    return agents


if __name__ == "__main__":
    main()
