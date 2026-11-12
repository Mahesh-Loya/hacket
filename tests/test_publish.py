import json

from agents import publish

PICKS = [{"category": "games", "ids": ["id-1", "id-2"]}, {"category": "grand", "ids": ["id-1"]}]


def test_build_command_shape():
    argv = publish.build_command("screener", PICKS)
    assert argv[1:5] == ["contract", "call-function", "as-transaction", "market.hackket.testnet"]
    assert "submit_picks" in argv
    assert argv[argv.index("sign-as") + 1] == "screener.hackket.testnet"
    payload = json.loads(argv[argv.index("json-args") + 1])
    assert payload == {"picks": PICKS}
    assert argv[argv.index("network-config") + 1] == "testnet"


def test_dry_run_prints_not_runs(monkeypatch, capsys):
    ran = []
    monkeypatch.setattr(publish.subprocess, "run", lambda *a, **k: ran.append(a))
    publish.publish_all({"screener": {"picks": PICKS}, "hype": {"picks": PICKS}}, dry_run=True)
    assert ran == []
    out = capsys.readouterr().out
    assert "screener.hackket.testnet" in out and "hype.hackket.testnet" in out
