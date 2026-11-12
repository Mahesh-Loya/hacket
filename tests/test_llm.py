import json

from agents import llm

FACTS = {"id": "id-1", "name": "P", "summary": "old", "mechanic_novelty": 1, "near_depth": 1, "polish": 1}
PROJECT = {"submission_id": "id-1", "name": "P", "description": "A sealed-bid market.", "updated_at": "t1"}


def test_enrich_parses_json(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    monkeypatch.delenv("NEARAI_API_KEY", raising=False)
    reply = '{"summary": "Agents bid for GPU time.", "mechanic_novelty": 9, "near_depth": 3, "polish": -2}'
    monkeypatch.setattr(llm, "_complete", lambda prompt: reply)
    out = llm.enrich(dict(FACTS), PROJECT, "readme")
    assert out["summary"] == "Agents bid for GPU time."
    assert out["mechanic_novelty"] == 5  # clamped
    assert out["near_depth"] == 3
    assert out["polish"] == 0  # clamped


def test_enrich_falls_back_on_error(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")

    def boom(prompt):
        raise RuntimeError("network down")

    monkeypatch.setattr(llm, "_complete", boom)
    assert llm.enrich(dict(FACTS), PROJECT, None) == FACTS


def test_enrich_falls_back_on_bad_json(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    monkeypatch.setattr(llm, "_complete", lambda prompt: "sure! here you go")
    assert llm.enrich(dict(FACTS), PROJECT, None) == FACTS


def test_prompt_truncates_readme_and_marks_claims(monkeypatch):
    seen = []
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    monkeypatch.setattr(llm, "_complete", lambda prompt: seen.append(prompt) or "{}")
    llm.enrich(dict(FACTS), PROJECT, "x" * 20000)
    assert "x" * 6000 in seen[0] and "x" * 6001 not in seen[0]
    assert "builder's own claims" in seen[0]


def test_enrich_all_uses_cache(monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    calls = []
    monkeypatch.setattr(llm, "_complete", lambda p: calls.append(1) or '{"polish": 4}')
    cache = tmp_path / "c.json"
    llm.enrich_all([dict(FACTS)], [PROJECT], [None], cache_path=str(cache))
    out = llm.enrich_all([dict(FACTS)], [PROJECT], [None], cache_path=str(cache))
    assert len(calls) == 1
    assert out[0]["polish"] == 4
    assert json.loads(cache.read_text(encoding="utf-8"))


def test_enrich_all_does_not_cache_failures(monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    replies = iter(["oops", '{"polish": 3}'])
    monkeypatch.setattr(llm, "_complete", lambda p: next(replies))
    cache = tmp_path / "c.json"
    llm.enrich_all([dict(FACTS)], [PROJECT], [None], cache_path=str(cache))
    out = llm.enrich_all([dict(FACTS)], [PROJECT], [None], cache_path=str(cache))
    assert out[0]["polish"] == 3
