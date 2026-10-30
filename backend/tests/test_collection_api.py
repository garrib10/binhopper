"""Collection API (SPEC.md › Collection; #41)."""

from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.main import app
from app.models import Album, AlbumGenre, Artist, CollectionItem, Pressing
from app.routers.stock import get_now
from tests.helpers import NOW

URL = "/api/me/collection"


def add_album(session, title, artist_name, year=None, genre=None, notes=("Original press",)):
    artist = session.scalar(select(Artist).where(Artist.name == artist_name)) or Artist(name=artist_name)
    session.add(artist)
    session.flush()
    album = Album(artist_id=artist.id, title=title, year=year)
    session.add(album)
    session.flush()
    if genre:
        session.add(AlbumGenre(album_id=album.id, genre=genre))
    pressings = [Pressing(album_id=album.id, variant_note=n, label="Label", format="LP") for n in notes]
    session.add_all(pressings)
    session.commit()
    return pressings


@pytest.fixture
def rumours(session):
    return add_album(session, "Rumours", "Fleetwood Mac", 1977, "Rock", ("Original press", "180g reissue"))


def test_signed_out_requests_are_refused(client, rumours):
    assert client.get(URL).status_code == 401
    assert client.post(URL, json={"pressing_id": rumours[0].id},
                       headers={"X-Binhopper-CSRF": "1"}).status_code == 401


def test_a_copy_records_pressing_grades_price_place_and_notes(client, sign_in, rumours):
    sign_in()
    response = client.post(URL, json={"pressing_id": rumours[0].id, "media_grade": "VG+",
                                      "sleeve_grade": "VG", "price_paid": 32, "bought_at": " Second Pressing ",
                                      "notes": "Light crackle on side B"})
    assert response.status_code == 201
    copy = response.json()
    assert (copy["pressing"]["note"], copy["media_grade"], copy["sleeve_grade"], copy["price_paid"],
            copy["bought_at"], copy["copy_number"]) == ("Original press", "VG+", "VG", 32.0,
                                                        "Second Pressing", 1)
    detail = client.get(f"{URL}/{copy['id']}").json()
    assert [p["note"] for p in detail["pressings"]] == ["Original press", "180g reissue"]


def test_AC_09_an_owned_pressing_warns_and_add_as_2nd_copy_creates_copy_2(client, sign_in, rumours, session):
    sign_in()
    client.post(URL, json={"pressing_id": rumours[0].id})
    again = client.post(URL, json={"pressing_id": rumours[0].id})
    assert again.status_code == 409
    assert again.json()["detail"] == {"message": "You already own this pressing", "copies": 1}
    assert session.scalar(select(func.count()).select_from(CollectionItem)) == 1
    second = client.post(URL, json={"pressing_id": rumours[0].id, "another_copy": True})
    assert (second.status_code, second.json()["copy_number"]) == (201, 2)
    # A different pressing of the same album is not a duplicate.
    assert client.post(URL, json={"pressing_id": rumours[1].id}).status_code == 201
    stats = client.get(URL).json()["stats"]
    assert (stats["records"], stats["artists"], stats["duplicates"]) == (3, 1, 1)


def test_owned_pressings_for_the_album_page(client, sign_in, rumours):
    sign_in()
    client.post(URL, json={"pressing_id": rumours[0].id})
    client.post(URL, json={"pressing_id": rumours[0].id, "another_copy": True})
    response = client.get(f"{URL}/owned", params={"album_id": rumours[0].album_id})
    assert response.json() == {"album_id": rumours[0].album_id, "copies": {str(rumours[0].id): 2}}


def test_sorts_recent_artist_genre_and_year(client, sign_in, session):
    blue = add_album(session, "Blue", "Joni Mitchell", 1971, "Folk")
    kind = add_album(session, "Kind of Blue", "Miles Davis", 1959, "Jazz")
    ram = add_album(session, "Random Access Memories", "Daft Punk", 2013, "Electronic")
    sign_in()
    for minutes, pressings in enumerate([blue, kind, ram]):
        app.dependency_overrides[get_now] = lambda m=minutes: NOW + timedelta(minutes=m)
        client.post(URL, json={"pressing_id": pressings[0].id})

    def titles(sort):
        return [i["album"]["title"] for i in client.get(URL, params={"sort": sort}).json()["items"]]

    assert titles("recent") == ["Random Access Memories", "Kind of Blue", "Blue"]
    assert titles("artist") == ["Random Access Memories", "Blue", "Kind of Blue"]  # Daft, Joni, Miles
    assert titles("genre") == ["Random Access Memories", "Blue", "Kind of Blue"]  # Electronic, Folk, Jazz
    assert titles("year") == ["Kind of Blue", "Blue", "Random Access Memories"]
    assert client.get(URL, params={"sort": "value"}).status_code == 422


def test_editing_and_removing_a_copy(client, sign_in, rumours):
    sign_in()
    copy_id = client.post(URL, json={"pressing_id": rumours[0].id}).json()["id"]
    changed = client.patch(f"{URL}/{copy_id}", json={"pressing_id": rumours[1].id, "media_grade": "NM",
                                                      "sleeve_grade": "NM", "notes": ""})
    assert changed.status_code == 200
    assert (changed.json()["pressing"]["note"], changed.json()["media_grade"], changed.json()["notes"]) == (
        "180g reissue", "NM", None)
    assert client.delete(f"{URL}/{copy_id}").status_code == 204
    assert client.get(URL).json()["items"] == []


@pytest.mark.parametrize("body", [{"media_grade": "Great"}, {"sleeve_grade": "VG++"},
                                  {"price_paid": -1}, {"notes": "x" * 2001}])
def test_bad_details_are_rejected(client, sign_in, rumours, body):
    sign_in()
    assert client.post(URL, json={"pressing_id": rumours[0].id, **body}).status_code == 422


def test_a_pressing_from_another_album_is_rejected_on_edit(client, sign_in, rumours, session):
    other = add_album(session, "Tusk", "Fleetwood Mac")
    sign_in()
    copy_id = client.post(URL, json={"pressing_id": rumours[0].id}).json()["id"]
    assert client.patch(f"{URL}/{copy_id}", json={"pressing_id": other[0].id}).status_code == 422
    assert client.post(URL, json={"pressing_id": 999}).status_code == 404


def test_AC_13_another_users_collection_is_invisible(client, sign_in, rumours, session):
    sign_in("first@example.com")
    copy_id = client.post(URL, json={"pressing_id": rumours[0].id}).json()["id"]
    sign_in("second@example.com")
    assert client.get(URL).json()["items"] == []
    for response in (client.get(f"{URL}/{copy_id}"),
                     client.patch(f"{URL}/{copy_id}", json={"pressing_id": rumours[0].id}),
                     client.delete(f"{URL}/{copy_id}")):
        assert response.status_code == 404
    # Owning it in someone else's collection doesn't make it a duplicate for you.
    assert client.post(URL, json={"pressing_id": rumours[0].id}).status_code == 201
    assert session.scalar(select(func.count()).select_from(CollectionItem)) == 2


# --- Rule 6: getting a copy takes it off the wishlist -------------------------------

def wish(session, user, pressings, pressing=None):
    from app.models import WishlistItem
    session.add(WishlistItem(user_id=user.id, album_id=pressings[0].album_id,
                             pressing_id=pressing.id if pressing else None))
    session.commit()


def wishlist_rows(session):
    from app.models import WishlistItem
    return session.scalar(select(func.count()).select_from(WishlistItem))


def test_adding_any_pressing_removes_an_any_pressing_wish(client, sign_in, rumours, session):
    user = sign_in()
    wish(session, user, rumours)
    body = client.post(URL, json={"pressing_id": rumours[1].id}).json()
    assert (body["removed_from_wishlist"], body["album_on_wishlist"]) == (True, False)
    assert wishlist_rows(session) == 0


def test_adding_the_wanted_pressing_removes_that_wish(client, sign_in, rumours, session):
    user = sign_in()
    wish(session, user, rumours, rumours[0])
    assert client.post(URL, json={"pressing_id": rumours[0].id}).json()["removed_from_wishlist"] is True
    assert wishlist_rows(session) == 0


def test_a_wish_for_a_different_specific_pressing_stays(client, sign_in, rumours, session):
    user = sign_in()
    wish(session, user, rumours, rumours[0])  # wants the Original press
    body = client.post(URL, json={"pressing_id": rumours[1].id}).json()  # got the 180g reissue
    assert (body["removed_from_wishlist"], body["album_on_wishlist"]) == (False, True)
    assert wishlist_rows(session) == 1


def test_other_users_wishlists_are_left_alone(client, sign_in, rumours, session):
    other = sign_in("other@example.com")
    wish(session, other, rumours)
    sign_in("me@example.com")
    assert client.post(URL, json={"pressing_id": rumours[0].id}).json()["removed_from_wishlist"] is False
    assert wishlist_rows(session) == 1


# --- Every grade saves and shows in the collection ------------------------------------

@pytest.mark.parametrize("media", ["M", "NM", "VG+", "VG", "G+", "G", "P"])
@pytest.mark.parametrize("sleeve", ["M", "NM", "VG+", "VG", "G+", "G", "P"])
def test_every_media_and_sleeve_grade_saves_and_lists(client, sign_in, rumours, media, sleeve):
    sign_in()
    copy_id = client.post(URL, json={"pressing_id": rumours[0].id}).json()["id"]
    assert client.patch(f"{URL}/{copy_id}", json={"pressing_id": rumours[0].id, "media_grade": media,
                                                   "sleeve_grade": sleeve}).status_code == 200
    [item] = client.get(URL).json()["items"]
    assert (item["media_grade"], item["sleeve_grade"]) == (media, sleeve)
    detail = client.get(f"{URL}/{copy_id}").json()
    assert (detail["media_grade"], detail["sleeve_grade"]) == (media, sleeve)


def test_only_the_pressing_is_required(client, sign_in, rumours):
    sign_in()
    copy = client.post(URL, json={"pressing_id": rumours[0].id}).json()
    assert (copy["media_grade"], copy["sleeve_grade"], copy["price_paid"], copy["bought_at"], copy["notes"]) == (
        None, None, None, None, None)
    assert client.post(URL, json={"media_grade": "NM"}).status_code == 422  # no pressing
