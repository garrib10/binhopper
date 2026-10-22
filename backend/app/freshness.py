"""Stock freshness rules (SPEC.md › Nearby stock rules 3, 5 and 6)."""

from datetime import datetime, timedelta
from enum import Enum

VERIFIED_WINDOW = timedelta(hours=24)
OUT_OF_DATE_AFTER = timedelta(days=7)
MISSING_REPORTS_TO_FLAG = 2


class Freshness(str, Enum):
    VERIFIED = "verified"  # a user confirmed it on the shelf in the last 24 h
    CURRENT = "current"  # synced recently enough to trust
    OUT_OF_DATE = "out_of_date"  # "May be out of date" warning: last update > 7 days ago
    REPORTED_MISSING = "reported_missing"  # 2+ "not on the shelf" reports in 24 h


# Lower sorts first: verified listings lead, reported-missing ones sink.
SORT_TIER = {
    Freshness.VERIFIED: 0,
    Freshness.CURRENT: 1,
    Freshness.OUT_OF_DATE: 2,
    Freshness.REPORTED_MISSING: 3,
}


def classify(
    now: datetime,
    last_synced_at: datetime | None,
    last_verified_at: datetime | None,
    missing_reports_24h: int = 0,
) -> Freshness:
    if missing_reports_24h >= MISSING_REPORTS_TO_FLAG:
        return Freshness.REPORTED_MISSING
    if last_verified_at is not None and now - last_verified_at <= VERIFIED_WINDOW:
        return Freshness.VERIFIED
    latest = max((t for t in (last_synced_at, last_verified_at) if t is not None), default=None)
    if latest is None or now - latest > OUT_OF_DATE_AFTER:
        return Freshness.OUT_OF_DATE
    return Freshness.CURRENT
