"""Read NEAR Hackathon entries from the NearHunt public API (read-only)."""

import json
import pathlib
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from agents.config import NEARHUNT_API, NEARHUNT_WRITER, USER_AGENT


def _get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _get_json_retry_once(url: str) -> dict:
    try:
        return _get_json(url)
    except (urllib.error.URLError, TimeoutError):
        time.sleep(2)
        return _get_json(url)


def fetch_projects(snapshot_path: str = "data/projects.json", refresh: bool = False) -> list[dict]:
    """All projects written by nearhunt.near. With refresh=False (or when the API
    fails) the committed snapshot is used, so everything works offline."""
    snap = pathlib.Path(snapshot_path)
    if refresh:
        try:
            projects, cursor = [], None
            while True:
                query = {"limit": 100, "sort": "newest"}
                if cursor:
                    query["cursor"] = cursor
                page = _get_json_retry_once(f"{NEARHUNT_API}?{urllib.parse.urlencode(query)}")
                projects += [p for p in page.get("items", []) if p.get("account") == NEARHUNT_WRITER]
                cursor = page.get("next_cursor")
                if not cursor:
                    break
            snap.parent.mkdir(parents=True, exist_ok=True)
            snap.write_text(json.dumps(projects, ensure_ascii=False, indent=1), encoding="utf-8")
            return projects
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            print(f"NearHunt API unavailable ({e}); using snapshot {snap}")
    return json.loads(snap.read_text(encoding="utf-8"))


_GITHUB = re.compile(r"^https?://github\.com/([^/\s]+)/([^/\s#?]+)")


def fetch_readme(repo_url: str | None) -> str | None:
    """README.md from a public GitHub repo, or None if anything goes wrong."""
    m = _GITHUB.match(repo_url or "")
    if not m:
        return None
    owner, repo = m.group(1), m.group(2).removesuffix(".git")
    req = urllib.request.Request(
        f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md", headers={"User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
