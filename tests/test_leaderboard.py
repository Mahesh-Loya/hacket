import io
import json

from agents import leaderboard


class Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_view_decodes_rpc_bytes(monkeypatch):
    rows = [{"account_id": "screener.hackket.testnet", "score": 8, "is_agent": True, "updated_ns": "1"}]
    raw = list(json.dumps(rows).encode())
    monkeypatch.setattr(leaderboard.urllib.request, "urlopen",
                        lambda req, timeout=0: Resp(json.dumps({"result": {"result": raw}}).encode()))
    assert leaderboard.view("get_leaderboard", {"from_index": 0, "limit": 10}) == rows


def test_format_rows_labels_agents():
    text = leaderboard.format_rows([
        {"account_id": "screener.hackket.testnet", "score": 8, "is_agent": True, "updated_ns": "1"},
        {"account_id": "alice.testnet", "score": 3, "is_agent": False, "updated_ns": "2"},
    ])
    assert "1. screener.hackket.testnet (AI)  8" in text
    assert "2. alice.testnet  3" in text
