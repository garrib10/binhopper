"""Locate, hold, buy: the hand-off page and "Got it? Add to collection" (#40, AC-10)."""

from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.models import Album, Artist, CollectionItem, Pressing, StockListing, Store, WishlistItem
from tests.helpers import NOW


@pytest.fixture
def listing(session):
    artist = Artist(name="Fleetwood Mac")
    session.add(artist)
    session.flush()
    album = Album(artist_id=artist.id, title="Rumours", year=1977)
    session.add(album)
    session.flush()
    pressing = Pressing(album_id=album.id, variant_note="180g reissue", label="Warner Bros.", format="LP")
    store = Store(name="Spin Cycle Records", area="Chelsea", lat=40.75, lng=-74.0, phone="(212) 555-0101",
                  website="https://spincycle.example")
    session.add_all([pressing, store])
    session.flush()
    row = StockListing(store_id=store.id, pressing_id=pressing.id, price=26, condition="New", quantity=2,
                       source="manual", last_synced_at=NOW - timedelta(hours=3))
    session.add(row)
    session.commit()
    return row


def test_the_hand_off_page_shows_the_copy_and_how_to_reach_the_shop(client, listing):
    body = client.get(f"/api/listings/{listing.id}").json()
    assert (body["album"]["title"], body["pressing"]["note"], body["price"], body["condition"]) == (
        "Rumours", "180g reissue", 26.0, "New")
    assert (body["store"]["phone"], body["store"]["website"], body["discogs_url"]) == (
        "(212) 555-0101", "https://spincycle.example", None)


def test_a_discogs_listing_links_to_its_discogs_page(client, listing, session):
    listing.source, listing.discogs_listing_id, listing.last_synced_at = "discogs", 987, NOW
    session.commit()
    assert client.get(f"/api/listings/{listing.id}").json()["discogs_url"] == "https://www.discogs.com/sell/item/987"


def test_sold_out_listings_are_404(client, listing, session):
    listing.quantity = 0
    session.commit()
    assert client.get(f"/api/listings/{listing.id}").status_code == 404


def test_AC_10_got_it_adds_to_the_collection_and_leaves_the_wishlist(client, sign_in, listing, session):
    user = sign_in()
    session.add(WishlistItem(user_id=user.id, album_id=listing.pressing.album_id))
    session.commit()
    response = client.post("/api/me/collection/from-listing", json={"listing_id": listing.id})
    assert response.status_code == 201
    copy = response.json()
    assert (copy["pressing"]["note"], copy["price_paid"], copy["bought_at"], copy["media_grade"],
            copy["removed_from_wishlist"]) == ("180g reissue", 26.0, "Spin Cycle Records", "M", True)
    assert session.scalar(select(func.count()).select_from(WishlistItem)) == 0
    assert client.get("/api/me/collection").json()["items"][0]["album"]["title"] == "Rumours"


def test_AC_10_an_owned_pressing_asks_before_adding_copy_2(client, sign_in, listing, session):
    sign_in()
    client.post("/api/me/collection/from-listing", json={"listing_id": listing.id})
    again = client.post("/api/me/collection/from-listing", json={"listing_id": listing.id})
    assert (again.status_code, again.json()["detail"]["copies"]) == (409, 1)
    second = client.post("/api/me/collection/from-listing", json={"listing_id": listing.id, "another_copy": True})
    assert second.json()["copy_number"] == 2
    assert session.scalar(select(func.count()).select_from(CollectionItem)) == 2


def test_a_used_grade_carries_over_and_odd_conditions_do_not(client, sign_in, listing, session):
    sign_in()
    listing.condition = "VG+"
    session.commit()
    assert client.post("/api/me/collection/from-listing", json={"listing_id": listing.id}).json()["media_grade"] == "VG+"
    listing.condition = "Used"
    session.commit()
    copy = client.post("/api/me/collection/from-listing", json={"listing_id": listing.id, "another_copy": True}).json()
    assert copy["media_grade"] is None


def test_got_it_works_after_the_copy_sold_out(client, sign_in, listing, session):
    sign_in()
    listing.quantity = 0  # it sold, to this user
    session.commit()
    assert client.post("/api/me/collection/from-listing", json={"listing_id": listing.id}).status_code == 201


def test_got_it_needs_an_account_and_a_real_listing(client, sign_in, listing):
    assert client.post("/api/me/collection/from-listing", json={"listing_id": listing.id},
                       headers={"X-Binhopper-CSRF": "1"}).status_code == 401
    sign_in()
    assert client.post("/api/me/collection/from-listing", json={"listing_id": 999}).status_code == 404


def test_other_users_wishlists_are_untouched(client, sign_in, listing, session):
    other = sign_in("other@example.com")
    session.add(WishlistItem(user_id=other.id, album_id=listing.pressing.album_id))
    session.commit()
    sign_in("buyer@example.com")
    assert client.post("/api/me/collection/from-listing", json={"listing_id": listing.id}).json()["removed_from_wishlist"] is False
    assert session.scalar(select(func.count()).select_from(WishlistItem)) == 1


def test_got_it_keeps_a_wish_for_a_different_specific_pressing(client, sign_in, listing, session):
    user = sign_in()
    other = Pressing(album_id=listing.pressing.album_id, variant_note="Original press")
    session.add(other)
    session.flush()
    session.add(WishlistItem(user_id=user.id, album_id=other.album_id, pressing_id=other.id))
    session.commit()
    body = client.post("/api/me/collection/from-listing", json={"listing_id": listing.id}).json()
    assert (body["removed_from_wishlist"], body["album_on_wishlist"]) == (False, True)
