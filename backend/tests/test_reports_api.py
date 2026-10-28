"""Stock reports (#37): "I saw it here", AC-07 and AC-18."""

from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.main import app
from app.models import Album, Artist, Pressing, StockListing, StockReport, Store, ZipCode
from app.routers.stock import get_now
from tests.helpers import NOW, ZIP_10011, point_north


@pytest.fixture
def shelf(session):
    """Rumours (2 pressings), a shop listing it, and a call-to-check shop 12 mi away."""
    session.add(ZipCode(zip="10011", lat=ZIP_10011[0], lng=ZIP_10011[1]))
    artist = Artist(name="Fleetwood Mac")
    session.add(artist)
    session.flush()
    album = Album(artist_id=artist.id, title="Rumours", year=1977)
    session.add(album)
    session.flush()
    original = Pressing(album_id=album.id, variant_note="Original press")
    reissue = Pressing(album_id=album.id, variant_note="180g reissue")
    stocked = Store(name="Spin Cycle Records", area="Chelsea", lat=point_north(*ZIP_10011, 2)[0], lng=ZIP_10011[1])
    call = Store(name="Side B", area="Hoboken", lat=point_north(*ZIP_10011, 12)[0], lng=ZIP_10011[1])
    session.add_all([original, reissue, stocked, call])
    session.flush()
    listing = StockListing(store_id=stocked.id, pressing_id=reissue.id, price=26, condition="New", quantity=2,
                           source="manual", last_synced_at=NOW - timedelta(days=3))
    session.add(listing)
    session.commit()
    return {"album": album, "original": original, "reissue": reissue, "listing": listing, "call": call}


def report(client, listing_id, **body):
    return client.post(f"/api/stock/{listing_id}/reports", json=body)


def stock(client, album_id):
    return client.get(f"/api/albums/{album_id}/stock", params={"zip": "10011", "radius": 25}).json()


def test_reports_need_an_account(client, shelf):
    response = client.post(f"/api/stock/{shelf['listing'].id}/reports", json={"result": "present"},
                           headers={"X-Binhopper-CSRF": "1"})
    assert response.status_code == 401


def test_on_the_shelf_marks_the_listing_verified(client, sign_in, shelf):
    sign_in()
    assert stock(client, shelf["album"].id)["stores"][0]["freshness"] == "current"
    assert report(client, shelf["listing"].id, result="present").status_code == 201
    assert stock(client, shelf["album"].id)["stores"][0]["freshness"] == "verified"


def test_AC_07_a_second_report_the_same_day_is_429(client, sign_in, shelf):
    sign_in()
    assert report(client, shelf["listing"].id, result="present").status_code == 201
    again = report(client, shelf["listing"].id, result="missing")
    assert (again.status_code, again.json()) == (429, {"detail": "You already reported this today"})
    assert client.get(f"/api/stock/{shelf['listing'].id}").json()["reported_today"] is True
    app.dependency_overrides[get_now] = lambda: NOW + timedelta(hours=24, minutes=1)
    assert report(client, shelf["listing"].id, result="missing").status_code == 201


def test_AC_06_two_users_saying_missing_flag_it(client, sign_in, shelf):
    for email in ("a@example.com", "b@example.com"):
        sign_in(email)
        assert report(client, shelf["listing"].id, result="missing").status_code == 201
    assert stock(client, shelf["album"].id)["stores"][0]["freshness"] == "reported_missing"


def test_a_different_price_updates_our_listing(client, sign_in, shelf):
    sign_in()
    assert report(client, shelf["listing"].id, result="different_price").status_code == 422
    assert report(client, shelf["listing"].id, result="different_price", reported_price=29).status_code == 201
    store = stock(client, shelf["album"].id)["stores"][0]
    assert (store["price"], store["freshness"]) == (29.0, "verified")


def test_a_discogs_price_is_never_overwritten(client, sign_in, shelf, session):
    listing = shelf["listing"]
    listing.source, listing.discogs_listing_id, listing.last_synced_at = "discogs", 123, NOW - timedelta(hours=1)
    session.commit()
    sign_in()
    report(client, listing.id, result="different_price", reported_price=29)
    assert stock(client, shelf["album"].id)["stores"][0]["price"] == 26.0
    assert session.scalar(select(StockReport.reported_price)) == 29


def test_reports_are_limited_per_user(client, sign_in, shelf, monkeypatch):
    from app.routers import reports

    monkeypatch.setattr(reports.REPORTS_PER_USER, "limit", 0)
    sign_in()
    assert report(client, shelf["listing"].id, result="present").status_code == 429


def test_unknown_or_hidden_listings_are_404(client, sign_in, shelf, session):
    sign_in()
    assert report(client, 999, result="present").status_code == 404
    shelf["listing"].quantity = 0
    session.commit()
    assert report(client, shelf["listing"].id, result="present").status_code == 404


def sighting(client, shelf, **overrides):
    body = {"album_id": shelf["album"].id, "pressing_id": shelf["original"].id, "condition": "Used",
            "price": 22, **overrides}
    return client.post(f"/api/stores/{shelf['call'].id}/sightings", json=body)


def test_AC_18_seeing_it_at_a_call_to_check_shop_moves_the_shop_into_stock(client, sign_in, shelf):
    sign_in()
    before = stock(client, shelf["album"].id)
    assert [s["name"] for s in before["other_shops"]] == ["Side B"]
    form = client.get(f"/api/stores/{shelf['call'].id}/sighting", params={"album_id": shelf["album"].id}).json()
    assert [p["note"] for p in form["pressings"]] == ["Original press", "180g reissue"]
    assert sighting(client, shelf).status_code == 201
    after = stock(client, shelf["album"].id)
    assert after["other_shops"] == []
    side_b = next(s for s in after["stores"] if s["store_name"] == "Side B")
    assert (side_b["source"], side_b["freshness"], side_b["price"], side_b["condition"], side_b["pressing_note"]) == (
        "report", "verified", 22.0, "Used", "Original press")
    assert after["stores"][0]["store_name"] == "Side B"  # verified sorts first


def test_AC_18_after_24_hours_the_7_day_rule_applies(client, sign_in, shelf):
    sign_in()
    sighting(client, shelf)
    app.dependency_overrides[get_now] = lambda: NOW + timedelta(days=2)
    side_b = next(s for s in stock(client, shelf["album"].id)["stores"] if s["store_name"] == "Side B")
    assert side_b["freshness"] == "current"
    app.dependency_overrides[get_now] = lambda: NOW + timedelta(days=8)
    side_b = next(s for s in stock(client, shelf["album"].id)["stores"] if s["store_name"] == "Side B")
    assert side_b["freshness"] == "out_of_date"


def test_sightings_once_a_day_and_only_where_nothing_is_listed(client, sign_in, shelf, session):
    sign_in()
    assert sighting(client, shelf).status_code == 201
    assert sighting(client, shelf).status_code == 409  # now listed: report on the listing instead
    stocked = shelf["listing"].store_id
    assert client.post(f"/api/stores/{stocked}/sightings", json={
        "album_id": shelf["album"].id, "pressing_id": shelf["original"].id, "condition": "New",
        "price": 30}).status_code == 409
    shelf["call"].discogs_seller_name = "side-b"
    session.commit()
    assert client.get(f"/api/stores/{shelf['call'].id}/sighting",
                      params={"album_id": shelf["album"].id}).status_code == 409


@pytest.mark.parametrize("overrides, status", [({"price": 0}, 422), ({"condition": "VG+"}, 422),
                                               ({"pressing_id": 999}, 422), ({"album_id": 999}, 404)])
def test_bad_sightings_are_rejected(client, sign_in, shelf, overrides, status):
    sign_in()
    assert sighting(client, shelf, **overrides).status_code == status
    assert sighting(client, shelf).status_code == 201


def test_a_sold_out_report_listing_is_reused(client, sign_in, shelf, session):
    sign_in("a@example.com")
    sighting(client, shelf)
    listing = session.scalar(select(StockListing).where(StockListing.source == "report"))
    listing.quantity = 0
    session.commit()
    sign_in("b@example.com")
    assert sighting(client, shelf, price=25).status_code == 201
    assert session.scalar(select(func.count()).select_from(StockListing).where(StockListing.source == "report")) == 1
