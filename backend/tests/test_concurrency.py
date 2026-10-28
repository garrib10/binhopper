"""Concurrent sign-ups on real MySQL must not deadlock (#38 follow-up).

InnoDB locks index gaps on UPDATE/DELETE that match nothing; two requests that then
insert into those gaps deadlock (1213). These tests run only in the MySQL
`integration` job (TEST_DATABASE_URL); SQLite has no such locks.
"""

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import Session
from starlette.responses import Response

from app.models import RateLimitHit, User, UserSession
from app.rate_limit import Limit
from app.sessions import start_session
from tests.helpers import NOW

pytestmark = pytest.mark.skipif(not os.environ.get("TEST_DATABASE_URL"), reason="MySQL only")
THREADS = 16


def run_together(work):
    with ThreadPoolExecutor(THREADS) as pool:
        return list(pool.map(work, range(THREADS)))


def test_concurrent_new_rate_limit_buckets_do_not_deadlock(integration_engine):
    limit = Limit(f"concurrency-{uuid4().hex[:8]}", 5, timedelta(hours=1))

    def hit(n):
        with Session(integration_engine) as db:
            return limit.record(db, f"203.0.113.{n}", NOW)

    try:
        for _ in range(3):  # new rows, then increments of the same rows
            assert set(run_together(hit)) <= {1, 2, 3}
    finally:
        with integration_engine.begin() as conn:
            conn.execute(delete(RateLimitHit).where(RateLimitHit.bucket.like(f"{limit.name}:%")))


def test_concurrent_sign_ins_do_not_deadlock(integration_engine):
    tag = uuid4().hex[:8]
    with Session(integration_engine) as db:
        users = [User(username=f"conc-{tag}-{n}", email=f"conc-{tag}-{n}@example.com") for n in range(THREADS)]
        db.add_all(users)
        db.commit()
        ids = [u.id for u in users]

    def sign_in(n):
        with Session(integration_engine) as db:
            request = SimpleNamespace(cookies={}, url=SimpleNamespace(scheme="https"))
            start_session(db, db.get(User, ids[n]), request, Response(), NOW)

    try:
        run_together(sign_in)
        run_together(sign_in)  # second round also clears expired/presented sessions
    finally:
        with integration_engine.begin() as conn:
            conn.execute(delete(UserSession).where(UserSession.user_id.in_(ids)))
            conn.execute(delete(User).where(User.id.in_(ids)))
