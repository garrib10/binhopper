"""The test-data seed (scripts/seed_test_data.py) contains every case it promises."""

import pytest
from sqlalchemy import func, select

from app.freshness import Freshness
from app.geo import haversine_mi, within_radius
from app.models import Album, CollectionItem, Pressing, Store, User, ZipCode
from scripts import seed_test_data as seed
from tests.helpers import NOW


@pytest.fixture
def seeded(session):
    assert seed.load(session, now=NOW)
    return session


def store(session, name) -> Store:
    return session.scalar(select(Store).where(Store.name == name))


def miles_from_origin(s: Store) -> float:
    return haversine_mi(*seed.ORIGIN, s.lat, s.lng)


def stock(client, session, zip, radius):
    album_id = session.scalar(select(Album.id).where(Album.title == seed.ALBUM_TITLE))
    res = client.get(f"/api/albums/{album_id}/stock", params={"zip": zip, "radius": radius})
    return res


@pytest.mark.parametrize("radius", seed.EDGE_RADII)
def test_stores_sit_exactly_on_each_radius_and_just_past_it(seeded, radius):  # AC-02
    edge = miles_from_origin(store(seeded, f"Edge {radius} mi"))
    past = miles_from_origin(store(seeded, f"Past {radius} mi"))
    assert edge == pytest.approx(radius, abs=1e-6) and within_radius(edge, radius)
    assert past == pytest.approx(radius + 0.1, abs=1e-6) and not within_radius(past, radius)


@pytest.mark.parametrize("radius", seed.EDGE_RADII)
def test_api_includes_the_edge_store_and_excludes_the_one_past_it(client, seeded, radius):  # AC-01, AC-02
    names = {s["store_name"] for s in stock(client, seeded, seed.ORIGIN_ZIP, radius).json()["stores"]}
    assert f"Edge {radius} mi" in names
    assert f"Past {radius} mi" not in names


def test_every_freshness_tier_is_present_and_sorted(client, seeded):  # AC-05, AC-06
    stores = stock(client, seeded, seed.ORIGIN_ZIP, 10).json()["stores"]
    tiers = {s["store_name"]: s["freshness"] for s in stores if s["store_name"].startswith("Tier")}
    assert tiers == {
        "Tier verified": Freshness.VERIFIED,
        "Tier current": Freshness.CURRENT,
        "Tier out of date": Freshness.OUT_OF_DATE,
        "Tier reported missing": Freshness.REPORTED_MISSING,
    }
    assert stores[-1]["store_name"] == "Tier reported missing"  # sorts last


@pytest.mark.parametrize("radius", seed.EDGE_RADII)
def test_empty_zip_has_no_store_in_any_radius(client, seeded, radius):  # AC-03
    body = stock(client, seeded, seed.EMPTY_ZIP, radius).json()
    assert body["stores"] == []
    assert body["nearest_outside_mi"] > 300


def test_unknown_zip_is_not_loaded(client, seeded):  # AC-04
    assert seeded.get(ZipCode, seed.UNKNOWN_ZIP) is None
    assert stock(client, seeded, seed.UNKNOWN_ZIP, 25).status_code == 404


def test_album_has_two_pressings_and_the_user_owns_one(seeded):  # AC-09
    album = seeded.scalar(select(Album).where(Album.title == seed.ALBUM_TITLE))
    pressings = seeded.scalars(select(Pressing).where(Pressing.album_id == album.id)).all()
    assert len(pressings) == 2
    user = seeded.scalar(select(User).where(User.username == seed.TEST_USER))
    owned = seeded.scalars(select(CollectionItem).where(CollectionItem.user_id == user.id)).all()
    assert len(owned) == 1 and owned[0].pressing_id in {p.id for p in pressings}
    assert user.settings.privacy_collection == "private"


def test_every_named_case_exists(seeded):
    names = set(seeded.scalars(select(Store.name)).all())
    assert names == set(seed.CASES)


def test_loading_twice_adds_nothing(seeded):
    before = seeded.scalar(select(func.count()).select_from(Store))
    assert seed.load(seeded, now=NOW) is False
    assert seeded.scalar(select(func.count()).select_from(Store)) == before
