"""Nightly read-only check that the real Discogs API still works the way the worker expects (#69).

All tests fake Discogs; this is the one place that calls it, from a scheduled workflow
(.github/workflows/discogs-smoke.yml), never on pull requests. It makes two GET requests
through the worker's own quota-aware queue, then feeds the answers through the same code
the worker uses (apply_response) in a throwaway in-memory database. It fails loudly if
Discogs rejects the token, stops sending rate-limit headers, or changes a field we read.

    DISCOGS_TOKEN=... python -m scripts.discogs_smoke

The token comes only from the environment and is never printed.
"""

import os
import sys

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models  # noqa: F401 (registers the tables)
from app.catalog_refresh import apply_response
from app.config import settings
from app.db import Base
from app.discogs import RequestQueue
from app.models import utcnow

# Release 1 and its master: the first record in our CC0 fixture (tests/fixtures/discogs_cc0),
# long-standing and unlikely to change.
RELEASE_ID, MASTER_ID = 1, 1660109
RELEASE_FIELDS = ("id", "title", "artists", "formats", "labels", "tracklist", "master_id")
MASTER_FIELDS = ("id", "title", "artists", "tracklist")


class SmokeFailure(Exception):
    pass


def check_fields(kind: str, payload: dict, fields: tuple[str, ...]) -> None:
    missing = [f for f in fields if f not in payload]
    if missing:
        raise SmokeFailure(f"{kind} {payload.get('id')} is missing fields the worker reads: {', '.join(missing)}")


def run(token: str, transport: httpx.BaseTransport | None = None) -> list[str]:
    """Run the checks; return what passed (raises SmokeFailure on the first problem)."""
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    passed = []
    with Session(engine) as session:
        queue = RequestQueue(session, token, settings.discogs_user_agent, transport=transport)
        headers: list[httpx.Headers] = []
        queue.client.event_hooks["response"].append(lambda response: headers.append(response.headers))
        try:
            release = queue.get("releases", RELEASE_ID)
            if "X-Discogs-Ratelimit-Remaining" not in headers[0]:
                raise SmokeFailure("Discogs sent no X-Discogs-Ratelimit headers; the queue relies on them")
            check_fields("release", release, RELEASE_FIELDS)
            master = queue.get("masters", MASTER_ID)
            check_fields("master", master, MASTER_FIELDS)
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            hint = " (is the DISCOGS_TOKEN secret valid?)" if status in (401, 403) else ""
            raise SmokeFailure(f"Discogs answered {status} for {exc.request.url.path}{hint}") from exc
        finally:
            queue.close()
        passed.append(f"release {RELEASE_ID} and master {MASTER_ID} have every field the worker reads")
        if apply_response(session, "masters", master, utcnow()) is None:
            raise SmokeFailure("the worker's parser rejected the master")
        if apply_response(session, "releases", release, utcnow()) is None:
            raise SmokeFailure("the worker's parser rejected the release (no vinyl format?)")
        passed.append("the worker's parser stored both")
        passed.append(f"rate limit: {queue.limit}/min, {queue.remaining} left in this window")
    return passed


def main() -> None:
    token = os.environ.get("DISCOGS_TOKEN", "").strip()
    if not token:
        sys.exit("DISCOGS_TOKEN is not set: add it as a repository secret (Settings › Secrets › Actions).")
    try:
        for line in run(token):
            print(f"ok: {line}")
    except SmokeFailure as exc:
        sys.exit(f"Discogs smoke test FAILED: {exc}")


if __name__ == "__main__":
    main()
