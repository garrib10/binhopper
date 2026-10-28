"""Fixed-window rate limits stored in MySQL (SPEC.md › Privacy › Abuse limits).

Counters live in the database, so they survive restarts and Railway's sleep. The
client IP is the visitor's: ProxyHeadersMiddleware takes it from X-Forwarded-For,
and the origin secret (#122) stops anyone bypassing Vercel to fake that header.
"""

import hashlib
import math
import random
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import RateLimitHit
from app.routers.stock import get_now

DEADLOCK = 1213  # MySQL: "Deadlock found when trying to get lock; try restarting transaction"
SWEEP_CHANCE = 0.02
EPOCH = datetime(1970, 1, 1, tzinfo=UTC).replace(tzinfo=None)  # naive UTC, like stored times


class Limit:
    def __init__(self, name: str, limit: int, window: timedelta) -> None:
        self.name, self.limit, self.window = name, limit, window

    def bucket(self, key: str) -> str:
        # Hashed so an email address never sits in the table; fits VARCHAR(120).
        return f"{self.name}:{hashlib.sha256(key.encode()).hexdigest()[:40]}"

    def window_start(self, now: datetime) -> datetime:
        seconds = self.window.total_seconds()
        return EPOCH + timedelta(seconds=(now - EPOCH).total_seconds() // seconds * seconds)

    def retry_after(self, now: datetime) -> int:
        """Seconds until the current window ends."""
        left = self.window_start(now) + self.window - now
        return max(1, math.ceil(left.total_seconds()))

    def count(self, db: Session, key: str, now: datetime) -> int:
        return db.scalar(select(RateLimitHit.count).where(
            RateLimitHit.bucket == self.bucket(key),
            RateLimitHit.window_start == self.window_start(now))) or 0

    def exceeded(self, db: Session, key: str, now: datetime) -> bool:
        return self.count(db, key, now) >= self.limit

    def record(self, db: Session, key: str, now: datetime) -> int:
        """Count one hit and return the window's new total. Call it before other changes:
        it commits, and on a MySQL deadlock it rolls back and tries again."""
        bucket, start = self.bucket(key), self.window_start(now)
        for attempt in range(3):
            try:
                db.execute(upsert_hit(db, bucket, start))
                old = db.execute(select(RateLimitHit.window_start).where(
                    RateLimitHit.bucket == bucket, RateLimitHit.window_start < start)).scalars().all()
                if old:  # earlier windows of this bucket, deleted by exact key (no gap locks)
                    db.execute(delete(RateLimitHit).where(RateLimitHit.bucket == bucket,
                                                          RateLimitHit.window_start.in_(old)))
                if random.random() < SWEEP_CHANCE:
                    sweep(db, now)
                db.commit()
                break
            except OperationalError as exc:
                db.rollback()
                if exc.orig.args[0] != DEADLOCK or attempt == 2:
                    raise
        return self.count(db, key, now)

    def hit(self, db: Session, key: str, now: datetime) -> bool:
        """Count one hit; True if it went over the limit."""
        return self.record(db, key, now) > self.limit

    def too_many(self, now: datetime) -> HTTPException:
        minutes = math.ceil(self.retry_after(now) / 60)
        return HTTPException(429, f"Too many attempts. Try again in {minutes} minute"
                             f"{'' if minutes == 1 else 's'}.",
                             headers={"Retry-After": str(self.retry_after(now))})


def upsert_hit(db: Session, bucket: str, start: datetime):
    """One atomic insert-or-increment, so concurrent requests never wait on each other."""
    table = RateLimitHit.__table__
    values = {"bucket": bucket, "window_start": start, "count": 1}
    if db.get_bind().dialect.name == "mysql":
        return mysql_insert(table).values(**values).on_duplicate_key_update(count=table.c.count + 1)
    return (sqlite_insert(table).values(**values)
            .on_conflict_do_update(index_elements=["bucket", "window_start"],
                                   set_={"count": table.c.count + 1}))


def sweep(db: Session, now: datetime) -> None:
    """Now and then, drop counters from buckets that never came back (a day old or more)."""
    stale = db.execute(select(RateLimitHit.bucket, RateLimitHit.window_start).where(
        RateLimitHit.window_start < now - timedelta(days=1)).limit(500)).all()
    for bucket, start in stale:
        db.execute(delete(RateLimitHit).where(RateLimitHit.bucket == bucket,
                                              RateLimitHit.window_start == start))


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def per_ip(limit: Limit):
    """A route dependency: 429 once one IP goes over `limit`."""

    def check(request: Request, db: Annotated[Session, Depends(get_session)],
              now: Annotated[datetime, Depends(get_now)]) -> None:
        if limit.hit(db, client_ip(request), now):
            raise limit.too_many(now)

    return Depends(check)


# Search is public, so it's limited per IP; generous enough for real browsing.
SEARCH = Limit("search", 120, timedelta(minutes=1))
