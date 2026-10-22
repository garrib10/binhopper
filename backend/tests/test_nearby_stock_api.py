"""API tests for GET /api/albums/{id}/stock (SPEC.md acceptance criteria AC-01 to AC-06)."""

from datetime import timedelta

import pytest

from app.models import Album, Artist, Pressing, StockListing, StockReport, Store, ZipCode
from tests.helpers import NOW, ZIP_10011, point_north


def add_store(session, pressing, name, miles, **listing):
    lat, lng = point_north(*ZIP_10011, miles)
    store = Store(name=name, area="Test", lat=lat, lng=lng)
    session.add(store)
    session.flush()
    row = StockListing(
        store_id=store.id,
        pressing_id=pressing.id,
        price=listing.get("price", 25),
        condition=listing.get("condition", "New"),
        quantity=listing.get("quantity", 1),
        last_synced_at=listing.get("synced", NOW - timedelta(hours=6)),
        last_verified_at=listing.get("verified"),
    )
    session.add(row)
    session.flush()
    return row


@pytest.fixture
def pressing(session):
    session.add(ZipCode(zip="10011", lat=ZIP_10011[0], lng=ZIP_10011[1]))
    artist = Artist(name="Fleetwood Mac")
    session.add(artist)
    session.flush()
    album = Album(artist_id=artist.id, title="Rumours", year=1977)
    session.add(album)
    session.flush()
    p = Pressing(album_id=album.id, variant_note="180g reissue")
    session.add(p)
    session.flush()
    return p


def get_stock(client, album_id, zip="10011", radius=25):
    return client.get(f"/api/albums/{album_id}/stock", params={"zip": zip, "radius": radius})


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_only_stores_in_radius_closest_first(client, session, pressing):  # AC-01
    add_store(session, pressing, "Far", 21.4)
    add_store(session, pressing, "Near", 3.2)
    add_store(session, pressing, "Mid", 8.7)
    add_store(session, pressing, "Outside", 44)
    session.commit()

    body = get_stock(client, pressing.album_id).json()
    assert [s["store_name"] for s in body["stores"]] == ["Near", "Mid", "Far"]
    assert [s["distance_mi"] for s in body["stores"]] == [3.2, 8.7, 21.4]
    assert body["nearest_outside_mi"] is None


def test_store_exactly_at_radius_is_included(client, session, pressing):  # AC-02
    add_store(session, pressing, "Edge", 25)
    session.commit()
    names = [s["store_name"] for s in get_stock(client, pressing.album_id).json()["stores"]]
    assert names == ["Edge"]


def test_empty_radius_reports_nearest_copy(client, session, pressing):  # AC-03
    add_store(session, pressing, "Faraway", 38)
    session.commit()
    body = get_stock(client, pressing.album_id, radius=10).json()
    assert body["stores"] == []
    assert body["nearest_outside_mi"] == 38.0


def test_out_of_stock_listings_are_hidden(client, session, pressing):
    add_store(session, pressing, "Sold out", 2, quantity=0)
    session.commit()
    assert get_stock(client, pressing.album_id).json()["stores"] == []


@pytest.mark.parametrize("bad_zip", ["1001", "100111", "abcde", ""])
def test_invalid_zip_is_rejected(client, pressing, bad_zip):  # AC-04
    assert get_stock(client, pressing.album_id, zip=bad_zip).status_code == 422


def test_unknown_zip_is_404(client, pressing):  # AC-04
    assert get_stock(client, pressing.album_id, zip="99999").status_code == 404


def test_radius_must_be_an_allowed_value(client, pressing):
    assert get_stock(client, pressing.album_id, radius=30).status_code == 422


def test_unknown_album_is_404(client, pressing):
    assert get_stock(client, 9999).status_code == 404


def test_stale_listing_is_flagged(client, session, pressing):  # AC-05
    add_store(session, pressing, "Stale", 4, synced=NOW - timedelta(days=8))
    session.commit()
    store = get_stock(client, pressing.album_id).json()["stores"][0]
    assert store["freshness"] == "out_of_date"


def test_reported_missing_sorts_last(client, session, pressing):  # AC-06
    flagged = add_store(session, pressing, "Flagged", 1)
    add_store(session, pressing, "Fine", 9)
    for hours_ago in (1, 3):
        session.add(
            StockReport(
                listing_id=flagged.id, result="missing", created_at=NOW - timedelta(hours=hours_ago)
            )
        )
    session.commit()

    stores = get_stock(client, pressing.album_id).json()["stores"]
    assert [s["store_name"] for s in stores] == ["Fine", "Flagged"]
    assert stores[1]["freshness"] == "reported_missing"


def test_verified_listing_sorts_before_closer_unverified(client, session, pressing):
    add_store(session, pressing, "Close", 2)
    add_store(session, pressing, "Verified", 6, verified=NOW - timedelta(hours=2))
    session.commit()
    names = [s["store_name"] for s in get_stock(client, pressing.album_id).json()["stores"]]
    assert names == ["Verified", "Close"]
