import io
import json
import urllib.error

from agents import fetch


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _resp(obj):
    return FakeResp(json.dumps(obj).encode())


def test_paginates_until_cursor_null(monkeypatch, page, tmp_path):
    rows = page["items"][:2]
    pages = [{"items": [rows[0]], "next_cursor": "abc"}, {"items": [rows[1]], "next_cursor": None}]
    urls = []

    def fake_urlopen(req, timeout=0):
        urls.append(req.full_url)
        return _resp(pages[len(urls) - 1])

    monkeypatch.setattr(fetch.urllib.request, "urlopen", fake_urlopen)
    out = fetch.fetch_projects(str(tmp_path / "p.json"), refresh=True)
    assert [p["name"] for p in out] == ["Nims", "NEAR Agent Census"]
    assert "cursor=abc" in urls[1]
    assert json.loads((tmp_path / "p.json").read_text(encoding="utf-8"))[0]["name"] == "Nims"


def test_drops_rows_not_written_by_nearhunt(monkeypatch, page, tmp_path):
    monkeypatch.setattr(fetch.urllib.request, "urlopen", lambda req, timeout=0: _resp(page))
    out = fetch.fetch_projects(str(tmp_path / "p.json"), refresh=True)
    assert "Impostor" not in [p["name"] for p in out]
    assert len(out) == 2


def test_fetch_falls_back_to_snapshot(monkeypatch, tmp_path, capsys):
    snap = tmp_path / "p.json"
    snap.write_text(json.dumps([{"name": "Cached"}]), encoding="utf-8")
    calls = []

    def boom(req, timeout=0):
        calls.append(1)
        raise urllib.error.HTTPError(req.full_url, 503, "busy", {}, None)

    monkeypatch.setattr(fetch.urllib.request, "urlopen", boom)
    monkeypatch.setattr(fetch.time, "sleep", lambda s: None)
    out = fetch.fetch_projects(str(snap), refresh=True)
    assert out == [{"name": "Cached"}]
    assert len(calls) == 2
    assert "snapshot" in capsys.readouterr().out.lower()


def test_fetch_readme_none_without_repo():
    assert fetch.fetch_readme(None) is None
    assert fetch.fetch_readme("https://gitlab.com/x/y") is None
