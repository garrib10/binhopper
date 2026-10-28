"""You: settings, privacy, data export and account deletion (#42)."""

import csv
import io
import json

import pytest
from sqlalchemy import func, select

from app import mailer
from app.models import (
    Album, Artist, AuthToken, CollectionItem, Pressing, StockListing, StockReport, Store, User,
    UserSession, UserSettings, WishlistItem, ZipCode,
)
from tests.helpers import NOW, link_token

URL = "/api/me/settings"


@pytest.fixture
def records(session):
    session.add_all([ZipCode(zip="10011", lat=40.74, lng=-74.0), ZipCode(zip="06037", lat=41.6, lng=-72.7)])
    artist = Artist(name="Fleetwood Mac")
    session.add(artist)
    session.flush()
    album = Album(artist_id=artist.id, title="Rumours", year=1977)
    session.add(album)
    session.flush()
    pressing = Pressing(album_id=album.id, variant_note="Original press", label="Warner Bros.", format="LP")
    store = Store(name="Spin Cycle Records", lat=40.75, lng=-74.0)
    session.add_all([pressing, store])
    session.flush()
    listing = StockListing(store_id=store.id, pressing_id=pressing.id, price=26, condition="New", quantity=1,
                           source="manual", last_synced_at=NOW)
    session.add(listing)
    session.commit()
    return {"album": album, "pressing": pressing, "listing": listing}


def test_AC_13_defaults_are_only_me_and_match_system(client, sign_in):
    sign_in()
    body = client.get(URL).json()
    assert (body["privacy_profile"], body["privacy_collection"], body["privacy_wishlist"]) == ("private",) * 3
    assert (body["theme"], body["use_current_location"], body["default_radius_mi"]) == ("system", False, 25)


def test_settings_save_location_appearance_privacy_and_genres(client, sign_in, records):
    sign_in()
    response = client.patch(URL, json={"home_zip": "06037", "default_radius_mi": 50, "theme": "dark",
                                       "use_current_location": True, "privacy_collection": "public",
                                       "favorite_genres": ["Rock", "Jazz", "Rock"], "username": "Crate_Digger"})
    assert response.status_code == 200
    body = client.get(URL).json()
    assert (body["home_zip"], body["default_radius_mi"], body["theme"], body["use_current_location"]) == (
        "06037", 50, "dark", True)
    assert (body["privacy_collection"], body["privacy_wishlist"]) == ("public", "private")
    assert (body["favorite_genres"], body["username"]) == (["Rock", "Jazz"], "crate_digger")


@pytest.mark.parametrize("change, status", [
    ({"privacy_profile": "friends"}, 422),  # Friends comes later
    ({"default_radius_mi": 30}, 422),
    ({"theme": "neon"}, 422),
    ({"home_zip": "1234"}, 422),
    ({"home_zip": "99999"}, 422),  # not a ZIP we know
    ({"username": "no spaces"}, 422),
    ({"favorite_genres": ["Polka"]}, 422),
])
def test_bad_settings_are_rejected(client, sign_in, records, change, status):
    sign_in()
    assert client.patch(URL, json=change).status_code == status


def test_usernames_are_unique(client, sign_in):
    sign_in("first@example.com")
    client.patch(URL, json={"username": "crate_digger"})
    sign_in("second@example.com")
    response = client.patch(URL, json={"username": "crate_digger"})
    assert (response.status_code, response.json()["detail"]) == (409, "That username is taken")


def test_settings_need_an_account(client):
    assert client.get(URL).status_code == 401
    assert client.get("/api/me/export").status_code == 401


def own_things(session, user, records):
    session.add_all([
        WishlistItem(user_id=user.id, album_id=records["album"].id, max_price=35),
        CollectionItem(user_id=user.id, pressing_id=records["pressing"].id, media_grade="NM", sleeve_grade="VG+",
                       price_paid=32, bought_at="Second Pressing", notes='Has a "hype" sticker', added_at=NOW),
        StockReport(listing_id=records["listing"].id, user_id=user.id, result="present", created_at=NOW),
    ])
    session.commit()


def test_collection_exports_as_csv(client, sign_in, records, session):
    own_things(session, sign_in(), records)
    response = client.get("/api/me/export")
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"] == 'attachment; filename="binhopper-collection-2026-10-22.csv"'
    rows = list(csv.reader(io.StringIO(response.text)))
    assert rows[0][:3] == ["Artist", "Album", "Year"]
    assert rows[1] == ["Fleetwood Mac", "Rumours", "1977", "Original press", "Warner Bros.", "LP", "NM", "VG+",
                       "32.00", "Second Pressing", 'Has a "hype" sticker', "2026-10-22"]


def test_download_all_data(client, sign_in, records, session):
    own_things(session, sign_in(), records)
    data = json.loads(client.get("/api/me/data").text)
    assert data["account"]["email"] == "collector@example.com"
    assert data["settings"]["privacy_profile"] == "private"
    assert data["wishlist"][0]["max_price"] == 35.0
    assert data["collection"][0]["price_paid"] == 32.0
    assert data["stock_reports"][0]["result"] == "present"
    assert len(data["sessions"]) == 1 and "token_hash" not in data["sessions"][0]


def test_AC_15_deleting_removes_the_data_and_the_old_password_stops_working(client, records, session):
    client.headers["X-Binhopper-CSRF"] = "1"
    credentials = {"email": "leaving@example.com", "password": "spin-the-b-side"}
    client.post("/api/auth/register", json=credentials)
    client.post("/api/auth/verify", json={"token": link_token(mailer.outbox[-1])})
    user = session.scalar(select(User).where(User.email == "leaving@example.com"))
    own_things(session, user, records)
    client.post("/api/auth/forgot-password", json={"email": credentials["email"]})  # leaves a token row

    response = client.delete("/api/me")
    assert response.status_code == 204
    assert any("bh_session=" in c for c in response.headers.get_list("set-cookie"))
    for model in (User, UserSettings, WishlistItem, CollectionItem, UserSession, AuthToken):
        assert session.scalar(select(func.count()).select_from(model)) == 0, model.__name__
    # The report stays for listing accuracy, without the user.
    assert session.scalar(select(StockReport.user_id)) is None
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/sign-in", json=credentials).status_code == 401


def test_deleting_one_account_leaves_others(client, sign_in, records, session):
    other = sign_in("stays@example.com")
    own_things(session, other, records)
    sign_in("leaves@example.com")
    assert client.delete("/api/me").status_code == 204
    assert session.scalar(select(func.count()).select_from(CollectionItem)) == 1
    assert session.get(User, other.id) is not None
