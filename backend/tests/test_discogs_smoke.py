"""The nightly Discogs smoke test's own checks (#69), with Discogs faked: no test calls it."""

import httpx
import pytest

from scripts import discogs_smoke
from scripts.discogs_smoke import MASTER_ID, RELEASE_ID, SmokeFailure, run

HEADERS = {"X-Discogs-Ratelimit": "60", "X-Discogs-Ratelimit-Remaining": "58", "X-Discogs-Ratelimit-Used": "2"}
ARTISTS = [{"id": 1, "name": "The Persuader"}]
RELEASE = {"id": RELEASE_ID, "title": "Stockholm", "year": 1999, "master_id": MASTER_ID, "artists": ARTISTS,
           "formats": [{"name": "Vinyl", "descriptions": ["12\""]}], "labels": [{"name": "Svek", "catno": "SK032"}],
           "tracklist": [{"position": "A", "title": "Östermalm"}], "genres": ["Electronic"]}
MASTER = {"id": MASTER_ID, "title": "Stockholm", "year": 1999, "artists": ARTISTS,
          "tracklist": [{"position": "A", "title": "Östermalm"}], "genres": ["Electronic"]}


def fake(release=RELEASE, master=MASTER, status=200, headers=HEADERS):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        body = release if request.url.path == f"/releases/{RELEASE_ID}" else master
        return httpx.Response(status, json=body, headers=headers)

    return httpx.MockTransport(handler), seen


def test_a_healthy_api_passes_and_uses_the_token_and_user_agent():
    transport, seen = fake()
    passed = run("secret-token", transport)
    assert passed[0].startswith(f"release {RELEASE_ID} and master {MASTER_ID}")
    assert passed[-1] == "rate limit: 60/min, 58 left in this window"
    assert [r.url.path for r in seen] == [f"/releases/{RELEASE_ID}", f"/masters/{MASTER_ID}"]
    assert all(r.method == "GET" for r in seen)  # read-only
    assert seen[0].headers["authorization"] == "Discogs token=secret-token"
    assert seen[0].headers["user-agent"].startswith("Binhopper/")


def test_a_field_the_worker_reads_disappearing_fails():
    transport, _ = fake(release={k: v for k, v in RELEASE.items() if k != "tracklist"})
    with pytest.raises(SmokeFailure, match="missing fields the worker reads: tracklist"):
        run("t", transport)


def test_a_rejected_token_says_so():
    transport, _ = fake(status=401)
    with pytest.raises(SmokeFailure, match="answered 401.*DISCOGS_TOKEN"):
        run("t", transport)


def test_missing_rate_limit_headers_fail():
    transport, _ = fake(headers={})
    with pytest.raises(SmokeFailure, match="X-Discogs-Ratelimit"):
        run("t", transport)


def test_the_token_is_never_printed(monkeypatch, capsys):
    monkeypatch.setenv("DISCOGS_TOKEN", "secret-token")
    transport, _ = fake()
    monkeypatch.setattr(discogs_smoke, "run", lambda token: run(token, transport))
    discogs_smoke.main()
    assert "secret-token" not in capsys.readouterr().out


def test_no_token_stops_with_instructions(monkeypatch):
    monkeypatch.delenv("DISCOGS_TOKEN", raising=False)
    with pytest.raises(SystemExit, match="repository secret"):
        discogs_smoke.main()
