from agents.personas import PERSONAS, pick_all


def fact(i, tracks=("games",), **kw):
    base = dict(id=f"id-{i}", name=f"P{i}", tracks=list(tracks), has_repo=False, readme_ok=False,
                has_live_link=False, has_video=False, mentions_mainnet=False, mentions_intents=False,
                votes=0, comments=0, description_len=100, summary="", mechanic_novelty=0,
                near_depth=0, polish=0)
    base.update(kw)
    return base


FACTS = [
    fact(0, has_repo=True, readme_ok=True, has_live_link=True, has_video=True, polish=4),
    fact(1, mechanic_novelty=5, polish=1),
    fact(2, near_depth=5, mentions_mainnet=True, mentions_intents=True),
    fact(3, votes=9, comments=7),
    fact(4, polish=3, near_depth=3, mechanic_novelty=3),
    fact(5, tracks=("defi",), votes=1),
    fact(6, tracks=("defi", "games")),
    fact(7, tracks=("nfts",), has_repo=True),
    fact(8),
    fact(9, name="The Hackathon Market"),
]


def test_each_persona_returns_score_and_reason():
    assert list(PERSONAS) == ["screener", "mechanist", "builder", "hype", "contrarian"]
    for fn in PERSONAS.values():
        score, reason = fn(FACTS[0])
        assert isinstance(score, float)
        assert 0 < len(reason) <= 140


def test_pick_all_only_uses_tagged_projects():
    out = pick_all(FACTS, "hype", set())
    nfts = next(p for p in out["picks"] if p["category"] == "nfts")
    assert nfts["ids"] == ["id-7"]
    for p in out["picks"]:
        if p["category"] != "grand":
            tagged = {f["id"] for f in FACTS if p["category"] in f["tracks"]}
            assert set(p["ids"]) <= tagged


def test_pick_all_excludes_own_entry():
    out = pick_all(FACTS, "screener", {"id-0"})
    chosen = {i for p in out["picks"] for i in p["ids"]}
    assert "id-0" not in chosen
    assert "id-9" not in chosen  # excluded by name too


def test_grand_is_single_overall_top():
    out = pick_all(FACTS, "hype", set())
    grand = next(p for p in out["picks"] if p["category"] == "grand")
    assert grand["ids"] == ["id-3"]


def test_personas_disagree():
    grands = {pick_all(FACTS, name, set())["picks"][-1]["ids"][0] for name in PERSONAS}
    assert len(grands) >= 3


def test_ids_are_distinct_and_max_3_and_skip_empty_tracks():
    out = pick_all(FACTS, "builder", set())
    cats = [p["category"] for p in out["picks"]]
    assert "privacy" not in cats  # nobody tagged privacy
    assert cats[-1] == "grand"
    for p in out["picks"]:
        assert 1 <= len(p["ids"]) <= 3
        assert len(set(p["ids"])) == len(p["ids"])
    assert set(out["reasons"]) >= {i for p in out["picks"] for i in p["ids"]}
