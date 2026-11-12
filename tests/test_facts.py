from agents.facts import extract_facts

README = "We deploy a near-sdk contract on mainnet using NEAR Intents and chain signatures. " * 10


def test_facts_from_fixture_row(page):
    nims = page["items"][0]
    f = extract_facts(nims, None)
    assert f["id"] == nims["submission_id"]
    assert f["name"] == "Nims"
    assert f["tracks"] == ["games"]
    assert f["has_repo"] is False
    assert f["readme_ok"] is False
    assert f["has_live_link"] is True
    assert f["has_video"] is True
    assert f["votes"] == 5 and f["comments"] == 6
    assert f["summary"] == "Built at NEAR HACKATHON: Nims, a market town where every trader is an AI agent with its own wallet."
    for k in ("mechanic_novelty", "near_depth", "polish"):
        assert 0 <= f[k] <= 5


def test_facts_handle_null_description_and_repo(page):
    f = extract_facts(page["items"][1], None)
    assert f["summary"] == ""
    assert f["description_len"] == 0
    assert f["has_repo"] is False
    assert f["polish"] == 0


def test_readme_raises_near_depth(page):
    row = dict(page["items"][0], repository_url="https://github.com/a/b")
    without = extract_facts(row, None)
    with_readme = extract_facts(row, README)
    assert with_readme["readme_ok"] is True
    assert with_readme["mentions_mainnet"] and with_readme["mentions_intents"]
    assert with_readme["near_depth"] > without["near_depth"]
