"""Wishlist API (SPEC.md › Wishlist; #39)."""

from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.models import Album, Artist, Pressing, StockListing, Store, WishlistItem, ZipCode
from tests.helpers import NOW, ZIP_10011, point_north

URL = "/api/me/wishlist"


@pytest.fixture
def album(session):
    session.add(ZipCode(zip="10011", lat=ZIP_10011[0], lng=ZIP_10011[1]))
    artist = Artist(name="Fleetwood Mac")
    session.add(artist)
    session.flush()
    album = Album(artist_id=artist.id, title="Rumours", year=1977)
    session.add(album)
    session.flush()
    session.add_all([Pressing(album_id=album.id, variant_note="Original press"),
                     Pressing(album_id=album.id, variant_note="180g reissue")])
    session.commit()
    return album


def pressings(album):
    return sorted(album.pressings, key=lambda p: p.id)


def stock(session, pressing, name, miles, price=25, condition="New"):
    lat, lng = point_north(*ZIP_10011, miles)
    store = Store(name=name, area="Test", lat=lat, lng=lng)
    session.add(store)
    session.flush()
    session.add(StockListing(source="manual", store_id=store.id, pressing_id=pressing.id, price=price,
                             condition=condition, quantity=1, last_synced_at=NOW - timedelta(hours=2)))
    session.commit()


def test_signed_out_requests_are_refused(client, album):
    assert client.get(URL).status_code == 401
    response = client.post(URL, json={"album_id": album.id}, headers={"X-Binhopper-CSRF": "1"})
    assert response.status_code == 401


def test_AC_08_heart_adds_then_removes_and_the_state_survives(client, sign_in, album, session):
    sign_in()
    assert client.post(URL, json={"album_id": album.id}).status_code == 201
    assert client.post(URL, json={"album_id": album.id}).status_code == 200  # no duplicate
    assert client.get(f"{URL}/albums").json() == {"album_ids": [album.id]}
    assert client.delete(URL, params={"album_id": album.id}).status_code == 204
    assert client.get(f"{URL}/albums").json() == {"album_ids": []}
    assert session.scalar(select(func.count()).select_from(WishlistItem)) == 0


def test_in_stock_items_show_count_nearest_and_cheapest(client, sign_in, album, session):
    original, reissue = pressings(album)
    stock(session, reissue, "Near but pricey", 3.2, price=30)
    stock(session, original, "Cheaper", 8.7, price=24)
    stock(session, original, "Too far", 40)
    sign_in()
    client.post(URL, json={"album_id": album.id})
    [item] = client.get(URL, params={"zip": "10011", "radius": 25}).json()["items"]
    assert item["album"]["title"] == "Rumours" and item["album"]["artist"]["name"] == "Fleetwood Mac"
    assert item["store_count"] == 2
    assert item["nearest"] == {"store_name": "Near but pricey", "distance_mi": 3.2, "price": 30.0}
    assert item["cheapest"] == {"store_name": "Cheaper", "distance_mi": 8.7, "price": 24.0}
    assert item["nearest_outside_mi"] is None
    assert [p["note"] for p in item["pressings"]] == ["Original press", "180g reissue"]


def test_out_of_stock_items_show_the_nearest_copy(client, sign_in, album, session):
    stock(session, pressings(album)[0], "Far", 38)
    sign_in()
    client.post(URL, json={"album_id": album.id})
    [item] = client.get(URL, params={"radius": 25}).json()["items"]
    assert (item["store_count"], item["nearest"], item["nearest_outside_mi"]) == (0, None, 38.0)


def test_pressing_price_and_condition_targets_filter_the_stock(client, sign_in, album, session):
    original, reissue = pressings(album)
    stock(session, reissue, "Wrong pressing", 2, price=20)
    stock(session, original, "Over budget", 3, price=40)
    stock(session, original, "Too worn", 4, price=20, condition="VG")
    stock(session, original, "Just right", 5, price=30, condition="VG+")
    sign_in()
    item_id = client.post(URL, json={"album_id": album.id}).json()["id"]
    response = client.patch(f"{URL}/{item_id}", json={
        "pressing_id": original.id, "max_price": 35, "min_condition": "VG+"})
    assert response.status_code == 200
    [item] = client.get(URL).json()["items"]
    assert item["store_count"] == 1 and item["nearest"]["store_name"] == "Just right"
    assert (item["pressing_note"], item["max_price"], item["min_condition"]) == (
        "Original press", 35.0, "VG+")


def test_a_sealed_new_copy_meets_any_grade(client, sign_in, album, session):
    stock(session, pressings(album)[0], "Sealed", 2, condition="New")
    sign_in()
    client.post(URL, json={"album_id": album.id, "min_condition": "NM"})
    assert client.get(URL).json()["items"][0]["store_count"] == 1


@pytest.mark.parametrize("body, status", [
    ({"album_id": 999}, 404),
    ({"album_id": "ALBUM", "min_condition": "Great"}, 422),
    ({"album_id": "ALBUM", "max_price": -5}, 422),
    ({"album_id": "ALBUM", "pressing_id": 999}, 422),
])
def test_bad_targets_are_rejected(client, sign_in, album, body, status):
    sign_in()
    body = {k: (album.id if v == "ALBUM" else v) for k, v in body.items()}
    assert client.post(URL, json=body).status_code == status


def test_AC_13_another_users_wishlist_is_invisible(client, sign_in, album, session):
    sign_in("first@example.com")
    item_id = client.post(URL, json={"album_id": album.id}).json()["id"]
    sign_in("second@example.com")
    assert client.get(URL).json()["items"] == []
    assert client.get(f"{URL}/albums").json() == {"album_ids": []}
    assert client.patch(f"{URL}/{item_id}", json={"max_price": 10}).status_code == 404
    assert client.delete(f"{URL}/{item_id}").status_code == 404
    client.delete(URL, params={"album_id": album.id})  # removes only the caller's entries
    assert session.scalar(select(func.count()).select_from(WishlistItem)) == 1


def test_removing_one_item(client, sign_in, album):
    sign_in()
    item_id = client.post(URL, json={"album_id": album.id}).json()["id"]
    assert client.delete(f"{URL}/{item_id}").status_code == 204
    assert client.get(URL).json()["items"] == []


def test_unknown_zip_and_bad_radius(client, sign_in, album):
    sign_in()
    assert client.get(URL, params={"zip": "99999"}).status_code == 404
    assert client.get(URL, params={"radius": 30}).status_code == 422
