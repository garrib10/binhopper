"""Rate limits on sign-in, sign-up, emails and search (#38; SPEC › Abuse limits)."""

from datetime import timedelta
from types import SimpleNamespace

import pytest

from app import mailer
from app.main import app
from app.models import ZipCode
from app.rate_limit import SEARCH
from app.routers.stock import get_now
from tests.helpers import NOW, link_token

CSRF = {"X-Binhopper-CSRF": "1"}
PASSWORD = "spin-the-b-side"


@pytest.fixture
def api(client):
    client.headers.update(CSRF)
    return client


@pytest.fixture
def clock(client):
    now = SimpleNamespace(value=NOW)
    app.dependency_overrides[get_now] = lambda: now.value
    return now


def ip(address):
    return {"X-Forwarded-For": address}


def test_register_is_limited_to_5_an_hour_per_ip(api, clock):
    for n in range(5):
        response = api.post("/api/auth/register", headers=ip("203.0.113.1"),
                            json={"email": f"a{n}@example.com", "password": PASSWORD})
        assert response.status_code == 202
    blocked = api.post("/api/auth/register", headers=ip("203.0.113.1"),
                       json={"email": "a5@example.com", "password": PASSWORD})
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "Too many attempts. Try again in 60 minutes."
    assert blocked.headers["retry-after"] == "3600"
    # Another visitor (from X-Forwarded-For) has their own count.
    assert api.post("/api/auth/register", headers=ip("203.0.113.2"),
                    json={"email": "b@example.com", "password": PASSWORD}).status_code == 202
    clock.value = NOW + timedelta(hours=1)
    assert api.post("/api/auth/register", headers=ip("203.0.113.1"),
                    json={"email": "a5@example.com", "password": PASSWORD}).status_code == 202


def verified(api, email="collector@example.com"):
    api.post("/api/auth/register", json={"email": email, "password": PASSWORD},
             headers=ip("198.51.100.1"))
    api.post("/api/auth/verify", json={"token": link_token(mailer.outbox[-1])})
    api.cookies.clear()


def test_failed_sign_ins_are_limited_to_5_per_email(api, clock):
    verified(api)
    for n in range(5):
        response = api.post("/api/auth/sign-in", headers=ip(f"203.0.113.{n}"),
                            json={"email": "collector@example.com", "password": "wrong-password"})
        assert response.status_code == 401
    # Even the right password waits now, so guessing from many IPs doesn't help.
    blocked = api.post("/api/auth/sign-in", headers=ip("203.0.113.99"),
                       json={"email": "collector@example.com", "password": PASSWORD})
    assert blocked.status_code == 429 and "retry-after" in blocked.headers
    clock.value = NOW + timedelta(minutes=15)
    assert api.post("/api/auth/sign-in", headers=ip("203.0.113.99"), json={
        "email": "collector@example.com", "password": PASSWORD}).status_code == 200


def test_failed_sign_ins_are_limited_to_20_per_ip(api):
    for n in range(20):
        api.post("/api/auth/sign-in", headers=ip("203.0.113.5"),
                 json={"email": f"guess{n}@example.com", "password": "wrong-password"})
    blocked = api.post("/api/auth/sign-in", headers=ip("203.0.113.5"),
                       json={"email": "another@example.com", "password": "wrong-password"})
    assert blocked.status_code == 429


def test_unknown_emails_hit_the_same_per_email_limit(api):
    # So a 429 can't reveal whether the email has an account (AC-20).
    for _ in range(5):
        api.post("/api/auth/sign-in", json={"email": "nobody@example.com", "password": "x" * 10})
    assert api.post("/api/auth/sign-in", json={
        "email": "nobody@example.com", "password": "x" * 10}).status_code == 429


@pytest.mark.parametrize("path", ["/api/auth/forgot-password", "/api/auth/resend-verification"])
def test_per_email_limits_are_silent(api, path):
    api.post("/api/auth/register", json={"email": "slow@example.com", "password": PASSWORD})
    mailer.outbox.clear()
    responses = [api.post(path, headers=ip(f"203.0.113.{n}"), json={"email": "slow@example.com"})
                 for n in range(5)]
    assert {r.status_code for r in responses} == {202}
    assert len({r.text for r in responses}) == 1
    assert len(mailer.outbox) == 3  # the 4th and 5th were not sent


@pytest.mark.parametrize("path", ["/api/auth/forgot-password", "/api/auth/resend-verification"])
def test_email_requests_are_limited_to_10_an_hour_per_ip(api, path):
    for n in range(10):
        api.post(path, json={"email": f"x{n}@example.com"})
    assert api.post(path, json={"email": "x10@example.com"}).status_code == 429


@pytest.mark.parametrize("path", ["/api/auth/verify", "/api/auth/reset-password"])
def test_link_guessing_is_limited(api, path):
    body = {"token": "guess", "password": PASSWORD}
    assert {api.post(path, json=body).status_code for _ in range(20)} == {400}
    assert api.post(path, json=body).status_code == 429


def test_search_allows_120_a_minute_per_ip():
    assert (SEARCH.limit, SEARCH.window) == (120, timedelta(minutes=1))


@pytest.mark.parametrize("path", ["/api/search?q=ab", "/api/browse?genre=Rock"])
def test_search_is_limited_per_ip(client, session, path, clock, monkeypatch):
    monkeypatch.setattr(SEARCH, "limit", 3)  # the real 120 makes this test slow
    session.add(ZipCode(zip="10011", lat=40.7418, lng=-74.0040))
    session.commit()
    for _ in range(3):
        assert client.get(path, headers=ip("203.0.113.7")).status_code == 200
    blocked = client.get(path, headers=ip("203.0.113.7"))
    assert blocked.status_code == 429 and blocked.headers["retry-after"] == "60"
    assert client.get(path, headers=ip("203.0.113.8")).status_code == 200
    clock.value = NOW + timedelta(minutes=1)
    assert client.get(path, headers=ip("203.0.113.7")).status_code == 200
