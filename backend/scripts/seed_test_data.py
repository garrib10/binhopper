"""Known test data that hits every nearby-stock and freshness rule.

For integration and system tests, not for demos (that's seed_sample.py). Everything
sits around made-up ZIP codes in the 00xxx range, which the US doesn't use, so it can
share a database with real Census ZIPs without clashing.

What's in it (see CASES below for exact names):
- ORIGIN_ZIP 00001: stores exactly 10, 25, 50 and 100 mi due north, and 0.1 mi past each
- near ORIGIN_ZIP: one listing in each freshness tier (verified, current, out of date,
  reported missing)
- EMPTY_ZIP 00002: about 500 mi from every store, so every radius is empty
- UNKNOWN_ZIP 00000: deliberately not loaded (the API answers 404)
- one album with two pressings, and a test user who already owns one of them

Times are relative to `now`, so freshness tiers stay correct whenever it's loaded.
Run once after `alembic upgrade head` (MySQL or SQLite, whatever DATABASE_URL says):

    python -m scripts.seed_test_data
"""

import math
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.geo import EARTH_RADIUS_MI
from app.models import (
    Album,
    Artist,
    CollectionItem,
    Pressing,
    StockListing,
    StockReport,
    Store,
    User,
    UserSettings,
    ZipCode,
    utcnow,
)

ORIGIN_ZIP = "00001"
ORIGIN = (40.0, -100.0)
EMPTY_ZIP = "00002"
EMPTY = (47.0, -100.0)  # ~483 mi due north of ORIGIN, ~380 mi past the farthest store
UNKNOWN_ZIP = "00000"

ALBUM_TITLE = "Test Album"
EDGE_RADII = (10, 25, 50, 100)
JUST_OVER_MI = 0.1

# Store name → what it's for. Tests look stores up by these names.
CASES = {
    **{f"Edge {r} mi": f"exactly {r} mi from {ORIGIN_ZIP}" for r in EDGE_RADII},
    **{f"Past {r} mi": f"{r + JUST_OVER_MI} mi from {ORIGIN_ZIP}" for r in EDGE_RADII},
    "Tier verified": "verified 2 h ago",
    "Tier current": "synced 3 h ago, never verified",
    "Tier out of date": "synced 8 days ago, never verified (AC-05)",
    "Tier reported missing": "2 'missing' reports in the last 24 h (AC-06)",
}
TIER_DISTANCES_MI = {"Tier verified": 1.0, "Tier current": 2.0,
                     "Tier out of date": 3.0, "Tier reported missing": 4.0}
TEST_USER = "test-collector"


def point_north(lat: float, lng: float, miles: float) -> tuple[float, float]:
    """A point exactly `miles` due north: distance along a meridian is exact."""
    return lat + math.degrees(miles / EARTH_RADIUS_MI), lng


def load(session: Session, now: datetime | None = None) -> bool:
    """Insert the test data and commit. Returns False if it was already loaded."""
    if session.get(ZipCode, ORIGIN_ZIP) is not None:
        return False
    now = now or utcnow()

    session.add_all([ZipCode(zip=ORIGIN_ZIP, lat=ORIGIN[0], lng=ORIGIN[1]),
                     ZipCode(zip=EMPTY_ZIP, lat=EMPTY[0], lng=EMPTY[1])])
    artist = Artist(name="Test Artist")
    session.add(artist)
    session.flush()
    album = Album(artist_id=artist.id, title=ALBUM_TITLE, year=1999,
                  tracklist=[{"position": "A1", "title": "Test Track"}])
    session.add(album)
    session.flush()
    original = Pressing(album_id=album.id, label="Test Label", catalog_no="TL-001",
                        variant_note="Original press")
    reissue = Pressing(album_id=album.id, label="Test Label", catalog_no="TL-001R",
                       variant_note="180g reissue")
    session.add_all([original, reissue])
    session.flush()

    distances = {f"Edge {r} mi": float(r) for r in EDGE_RADII}
    distances |= {f"Past {r} mi": r + JUST_OVER_MI for r in EDGE_RADII}
    distances |= TIER_DISTANCES_MI
    stores = {}
    for name, miles in distances.items():
        lat, lng = point_north(*ORIGIN, miles)
        stores[name] = Store(name=name, area=CASES[name], lat=lat, lng=lng)
    session.add_all(stores.values())
    session.flush()

    def listing(store: str, **times) -> StockListing:
        return StockListing(source="manual", store_id=stores[store].id, pressing_id=reissue.id, price=25,
                            condition="New", quantity=1, **times)

    listings = {name: listing(name, last_synced_at=now - timedelta(hours=3))
                for name in distances if not name.startswith("Tier")}
    listings["Tier verified"] = listing("Tier verified", last_synced_at=now - timedelta(days=2),
                                        last_verified_at=now - timedelta(hours=2))
    listings["Tier current"] = listing("Tier current", last_synced_at=now - timedelta(hours=3))
    listings["Tier out of date"] = listing("Tier out of date",
                                           last_synced_at=now - timedelta(days=8))
    listings["Tier reported missing"] = listing("Tier reported missing",
                                                last_synced_at=now - timedelta(hours=3))
    session.add_all(listings.values())
    session.flush()

    missing = listings["Tier reported missing"].id
    session.add_all([StockReport(listing_id=missing, result="missing",
                                 created_at=now - timedelta(hours=h)) for h in (1, 5)])

    user = User(username=TEST_USER, email="test-collector@example.com")
    user.settings = UserSettings()  # private by default
    session.add(user)
    session.flush()
    session.add(CollectionItem(user_id=user.id, pressing_id=original.id, media_grade="VG+"))

    session.commit()
    return True


def main() -> None:
    with SessionLocal() as s:
        loaded = load(s)
    print("Loaded test data." if loaded else "Test data already loaded.")


if __name__ == "__main__":
    main()
