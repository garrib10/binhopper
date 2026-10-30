"""Discogs import (#44, AC-11). Discogs is faked with an httpx MockTransport: no test calls it."""

import json
from datetime import timedelta

import httpx
import pytest
from cryptography.fernet import Fernet
from sqlalchemy import func, select

from app.config import settings
from app.discogs import RequestQueue
from app.discogs_import import drain_imports, grade
from app.main import app
from app.models import (
    Album, Artist, CatalogJob, CollectionItem, DiscogsAccount, ImportJob, ImportPending, Pressing, User,
    WishlistItem,
)
from app.routers.discogs_import import get_discogs_queue
from app.token_crypto import decrypt, encrypt
from tests.helpers import NOW


@pytest.fixture(autouse=True)
def discogs_app(monkeypatch):
    monkeypatch.setattr(settings, "discogs_consumer_key", "consumer-key")
    monkeypatch.setattr(settings, "discogs_consumer_secret", "consumer-secret")
    monkeypatch.setattr(settings, "token_encryption_key", Fernet.generate_key().decode())


class FakeDiscogs:
    """Discogs' OAuth and collection/wantlist endpoints, from fixed data."""

    def __init__(self, collection=(), wants=(), per_page=100):
        self.collection, self.wants, self.per_page = list(collection), list(wants), per_page
        self.requests: list[httpx.Request] = []
        self.status = 200

    def page(self, items, request, key):
        page = int(request.url.params.get("page", 1))
        pages = max(1, -(-len(items) // self.per_page))
        chunk = items[(page - 1) * self.per_page: page * self.per_page]
        return httpx.Response(self.status, json={"pagination": {"page": page, "pages": pages}, key: chunk})

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if path == "/oauth/request_token":
            return httpx.Response(200, text="oauth_token=req-token&oauth_token_secret=req-secret&oauth_callback_confirmed=true")
        if path == "/oauth/access_token":
            return httpx.Response(200, text="oauth_token=user-token&oauth_token_secret=user-secret")
        if path == "/oauth/identity":
            return httpx.Response(200, json={"id": 1, "username": "crate_digger"})
        if path.endswith("/collection/folders/0/releases"):
            return self.page(self.collection, request, "releases")
        if path.endswith("/wants"):
            return self.page(self.wants, request, "wants")
        return httpx.Response(404)


def queue_for(session, fake):
    return RequestQueue(session, "", "Binhopper tests", transport=httpx.MockTransport(fake.handler), sleep=lambda _: None)


@pytest.fixture
def fake(session):
    discogs = FakeDiscogs()
    app.dependency_overrides[get_discogs_queue] = lambda: queue_for(session, discogs)
    return discogs


@pytest.fixture
def catalog(session):
    """Releases 101–105 are in the catalog (two albums); 999 isn't."""
    artist = Artist(name="Fleetwood Mac")
    session.add(artist)
    session.flush()
    rumours, tusk = Album(artist_id=artist.id, title="Rumours"), Album(artist_id=artist.id, title="Tusk")
    session.add_all([rumours, tusk])
    session.flush()
    rows = {rid: Pressing(album_id=(rumours if rid < 104 else tusk).id, discogs_release_id=rid,
                          variant_note=f"Release {rid}") for rid in (101, 102, 103, 104, 105)}
    session.add_all(rows.values())
    session.commit()
    return rows


def collection_item(release_id, media=None, sleeve=None, notes=None):
    fields = [(1, media), (2, sleeve), (3, notes)]
    return {"id": release_id, "instance_id": release_id * 10,
            "notes": [{"field_id": f, "value": v} for f, v in fields if v is not None]}


def connect(client, session, user):
    session.add(DiscogsAccount(user_id=user.id, username="crate_digger", token_enc=encrypt("user-token"),
                               secret_enc=encrypt("user-secret"), connected_at=NOW))
    session.commit()


# --- Connecting -------------------------------------------------------------------------

def test_status_before_connecting(client, sign_in, monkeypatch):
    sign_in()
    assert client.get("/api/me/import/discogs").json() == {"configured": True, "connected": False,
                                                           "username": None, "job": None}
    monkeypatch.setattr(settings, "discogs_consumer_key", "")
    assert client.get("/api/me/import/discogs").json()["configured"] is False
    assert client.get("/api/discogs/connect", follow_redirects=False).status_code == 404


def test_oauth_connects_and_stores_tokens_encrypted(client, sign_in, session, fake):
    sign_in()
    start = client.get("/api/discogs/connect", follow_redirects=False)
    assert start.headers["location"] == "https://discogs.com/oauth/authorize?oauth_token=req-token"
    signed = fake.requests[0].headers["authorization"]
    assert 'oauth_signature_method="PLAINTEXT"' in signed and 'oauth_signature="consumer-secret%26"' in signed
    assert "oauth_callback=" in signed

    done = client.get("/api/discogs/callback", params={"oauth_token": "req-token", "oauth_verifier": "v"},
                      follow_redirects=False)
    assert done.headers["location"] == "/import?connected=1"
    assert 'oauth_signature="consumer-secret%26req-secret"' in fake.requests[1].headers["authorization"]
    account = session.scalar(select(DiscogsAccount))
    assert account.username == "crate_digger"
    assert "user-token" not in account.token_enc and decrypt(account.token_enc) == "user-token"
    assert client.get("/api/me/import/discogs").json()["username"] == "crate_digger"


@pytest.mark.parametrize("params", [{"oauth_token": "other-token", "oauth_verifier": "v"},  # not this flow
                                    {"denied": "req-token"}])  # the user said no on Discogs
def test_a_mismatched_or_denied_callback_connects_nothing(client, sign_in, session, fake, params):
    sign_in()
    client.get("/api/discogs/connect", follow_redirects=False)
    response = client.get("/api/discogs/callback", params=params, follow_redirects=False)
    assert response.headers["location"] == "/import?error=discogs"
    assert session.scalar(select(func.count()).select_from(DiscogsAccount)) == 0


def test_a_flow_started_by_another_account_is_refused(client, sign_in, session, fake):
    sign_in("first@example.com")
    client.get("/api/discogs/connect", follow_redirects=False)
    sign_in("second@example.com")  # same browser, different account
    response = client.get("/api/discogs/callback", params={"oauth_token": "req-token", "oauth_verifier": "v"},
                          follow_redirects=False)
    assert response.headers["location"] == "/import?error=discogs"


def test_disconnecting_removes_the_tokens(client, sign_in, session):
    connect(client, session, sign_in())
    assert client.delete("/api/me/discogs").status_code == 204
    assert session.scalar(select(func.count()).select_from(DiscogsAccount)) == 0


# --- Starting -----------------------------------------------------------------------------

def test_an_import_needs_a_connection_and_runs_one_at_a_time(client, sign_in, session):
    user = sign_in()
    assert client.post("/api/me/import/discogs", json={}).status_code == 409
    connect(client, session, user)
    assert client.post("/api/me/import/discogs", json={"collection": False, "wantlist": False}).status_code == 422
    started = client.post("/api/me/import/discogs", json={"collection": True, "wantlist": False})
    assert (started.status_code, started.json()["status"]) == (202, "queued")
    assert client.post("/api/me/import/discogs", json={}).status_code == 409
    job = session.scalar(select(ImportJob))
    assert (job.collection_page, job.wantlist_page) == (1, None)


# --- The worker -----------------------------------------------------------------------------

def run(session, fake, user, collection=True, wantlist=True, created=NOW):
    job = ImportJob(user_id=user.id, status="queued", created_at=created, added=0, wishlisted=0, skipped=0,
                    unmatched=0, collection_page=1 if collection else None, wantlist_page=1 if wantlist else None)
    session.add(job)
    session.commit()
    drain_imports(queue_for(session, fake), now=lambda: NOW + timedelta(minutes=1))
    session.refresh(job)
    return job


def test_collection_keeps_pressing_condition_and_notes_and_wantlist_goes_to_the_wishlist(client, sign_in, session, catalog):
    user = sign_in()
    connect(client, session, user)
    fake = FakeDiscogs(collection=[collection_item(101, "Very Good Plus (VG+)", "Near Mint (NM or M-)", "Gatefold")],
                       wants=[{"id": 104}])
    job = run(session, fake, user)
    assert (job.status, job.added, job.wishlisted, job.skipped) == ("done", 1, 1, 0)
    copy = session.scalar(select(CollectionItem))
    assert (copy.pressing_id, copy.media_grade, copy.sleeve_grade, copy.notes) == (catalog[101].id, "VG+", "NM", "Gatefold")
    want = session.scalar(select(WishlistItem))
    assert (want.album_id, want.pressing_id) == (catalog[104].album_id, catalog[104].id)
    calls = [r for r in fake.requests if "/users/" in r.url.path]
    assert all('oauth_token="user-token"' in r.headers["authorization"] for r in calls)


def test_AC_11_releases_already_in_the_collection_are_skipped_without_duplicates(client, sign_in, session, catalog):
    user = sign_in()
    connect(client, session, user)
    for rid in (101, 102, 104):  # owned before the import
        session.add(CollectionItem(user_id=user.id, pressing_id=catalog[rid].id, added_at=NOW - timedelta(days=3)))
    session.commit()
    fake = FakeDiscogs(collection=[collection_item(r) for r in (101, 102, 104, 105)])
    job = run(session, fake, user, wantlist=False)
    assert (job.added, job.skipped) == (1, 3)
    assert session.scalar(select(func.count()).select_from(CollectionItem)) == 4
    summary = client.get("/api/me/import/discogs").json()["job"]
    assert (summary["status"], summary["added"], summary["skipped"]) == ("done", 1, 3)


def test_two_copies_on_discogs_come_in_as_two_copies(client, sign_in, session, catalog):
    user = sign_in()
    connect(client, session, user)
    job = run(session, FakeDiscogs(collection=[collection_item(103), collection_item(103)]), user, wantlist=False)
    assert job.added == 2 and session.scalar(select(func.count()).select_from(CollectionItem)) == 2


def test_it_pages_through_large_collections(client, sign_in, session, catalog):
    user = sign_in()
    connect(client, session, user)
    fake = FakeDiscogs(collection=[collection_item(r) for r in (101, 102, 103, 104, 105)], per_page=2)
    job = run(session, fake, user, wantlist=False)
    assert job.added == 5
    pages = [r.url.params["page"] for r in fake.requests if "collection" in r.url.path]
    assert pages == ["1", "2", "3"]


def test_unknown_releases_wait_for_the_catalog_lookup_then_land(client, sign_in, session, catalog):
    user = sign_in()
    connect(client, session, user)
    fake = FakeDiscogs(collection=[collection_item(999, "Mint (M)")], wants=[{"id": 998}])
    job = run(session, fake, user)
    assert job.status == "running"  # still looking up
    assert client.get("/api/me/import/discogs").json()["job"]["looking_up"] == 2
    assert sorted(session.scalars(select(CatalogJob.discogs_id))) == [998, 999]

    session.add(Pressing(album_id=catalog[101].album_id, discogs_release_id=999))  # the lookup finished
    session.commit()
    drain_imports(queue_for(session, fake), now=lambda: NOW + timedelta(minutes=10))
    session.refresh(job)
    assert (job.added, job.status) == (1, "running")  # 998 still unknown
    drain_imports(queue_for(session, fake), now=lambda: NOW + timedelta(days=2))
    session.refresh(job)
    assert (job.status, job.unmatched) == ("done", 1)
    assert session.scalar(select(CollectionItem.media_grade)) == "M"


def test_a_revoked_connection_fails_the_import_with_a_message(client, sign_in, session, catalog):
    user = sign_in()
    connect(client, session, user)
    fake = FakeDiscogs(collection=[collection_item(101)])
    fake.status = 401
    job = run(session, fake, user, wantlist=False)
    assert job.status == "failed" and "Connect again" in job.error


def test_deleting_the_account_removes_discogs_data(client, sign_in, session, catalog):
    user = sign_in()
    connect(client, session, user)
    run(session, FakeDiscogs(collection=[collection_item(999)]), user, wantlist=False)
    assert client.delete("/api/me").status_code == 204
    for model in (DiscogsAccount, ImportJob, ImportPending, User):
        assert session.scalar(select(func.count()).select_from(model)) == 0, model.__name__


@pytest.mark.parametrize("text, expected", [("Mint (M)", "M"), ("Near Mint (NM or M-)", "NM"),
                                            ("Very Good Plus (VG+)", "VG+"), ("Very Good (VG)", "VG"),
                                            ("Good Plus (G+)", "G+"), ("Good (G)", "G"), ("Fair (F)", "P"),
                                            ("Poor (P)", "P"), ("Generic", None), (None, None)])
def test_discogs_condition_names_become_grades(text, expected):
    assert grade(text) == expected


def test_the_data_download_lists_the_connection(client, sign_in, session):
    connect(client, session, sign_in())
    data = json.loads(client.get("/api/me/data").text)
    assert data["discogs"]["username"] == "crate_digger" and "token" not in json.dumps(data["discogs"])


def test_the_callback_url_is_the_apps(client, sign_in, fake, monkeypatch):
    monkeypatch.setattr(settings, "public_app_url", "https://binhopper.example")
    sign_in()
    client.get("/api/discogs/connect", follow_redirects=False)
    header = fake.requests[0].headers["authorization"]
    assert 'oauth_callback="https%3A%2F%2Fbinhopper.example%2Fapi%2Fdiscogs%2Fcallback"' in header


def test_imported_copies_take_matching_wishes_off_the_wishlist(client, sign_in, session, catalog):
    user = sign_in()
    connect(client, session, user)
    session.add_all([WishlistItem(user_id=user.id, album_id=catalog[101].album_id),  # Rumours, any pressing
                     WishlistItem(user_id=user.id, album_id=catalog[104].album_id, pressing_id=catalog[105].id)])
    session.commit()
    run(session, FakeDiscogs(collection=[collection_item(101), collection_item(104)]), user, wantlist=False)
    wanted = session.scalars(select(WishlistItem.pressing_id)).all()
    assert wanted == [catalog[105].id]  # the Rumours wish went; the Tusk wish for another pressing stayed


def test_a_wantlist_entry_for_a_pressing_already_owned_is_skipped(client, sign_in, session, catalog):
    user = sign_in()
    connect(client, session, user)
    session.add(CollectionItem(user_id=user.id, pressing_id=catalog[104].id, added_at=NOW - timedelta(days=1)))
    session.commit()
    job = run(session, FakeDiscogs(wants=[{"id": 104}]), user, collection=False)
    assert (job.wishlisted, job.skipped) == (0, 1)
