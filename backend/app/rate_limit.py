"""Fixed-window rate limits stored in MySQL (SPEC.md › Privacy › Abuse limits).

Counters live in the database, so they survive restarts and Railway's sleep. The
client IP is the visitor's: ProxyHeadersMiddleware takes it from X-Forwarded-For,
and the origin secret (#122) stops anyone bypassing Vercel to fake that header.
"""

import hashlib
import math
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import RateLimitHit
from app.routers.stock import get_now

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
        """Count one hit and return the window's new total."""
        bucket, start = self.bucket(key), self.window_start(now)
        bump = (update(RateLimitHit).where(RateLimitHit.bucket == bucket,
                                           RateLimitHit.window_start == start)
                .values(count=RateLimitHit.count + 1))
        if db.execute(bump).rowcount == 0:
            try:
                with db.begin_nested():
                    db.add(RateLimitHit(bucket=bucket, window_start=start, count=1))
            except IntegrityError:  # another request created the row first
                db.execute(bump)
        db.execute(delete(RateLimitHit).where(RateLimitHit.bucket == bucket,
                                              RateLimitHit.window_start < start))
        db.commit()
        return self.count(db, key, now)

    def hit(self, db: Session, key: str, now: datetime) -> bool:
        """Count one hit; True if it went over the limit."""
        return self.record(db, key, now) > self.limit

    def too_many(self, now: datetime) -> HTTPException:
        minutes = math.ceil(self.retry_after(now) / 60)
        return HTTPException(429, f"Too many attempts. Try again in {minutes} minute"
                             f"{'' if minutes == 1 else 's'}.",
                             headers={"Retry-After": str(self.retry_after(now))})


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
