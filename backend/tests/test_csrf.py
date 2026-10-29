"""Requests that change things must come from the app itself (#38)."""

import pytest

from app.config import settings

SIGN_OUT = "/api/auth/sign-out"  # a POST that needs no body or account


def test_unsafe_requests_without_the_app_header_are_forbidden(client):
    response = client.post(SIGN_OUT)
    assert (response.status_code, response.json()) == (403, {"detail": "Forbidden"})


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_every_unsafe_method_is_checked(client, method):
    assert getattr(client, method)(SIGN_OUT).status_code == 403


def test_the_app_header_lets_requests_through(client):
    assert client.post(SIGN_OUT, headers={"X-Binhopper-CSRF": "1"}).status_code == 204


@pytest.mark.parametrize("origin, allowed", [
    ("https://evil.example.com", False),
    ("http://localhost:5173", True),  # local Vite
    ("https://binhopper-git-staging-garrib11.vercel.app", True),  # PUBLIC_APP_URL below
    ("null", False),
])
def test_a_foreign_origin_is_forbidden(client, monkeypatch, origin, allowed):
    monkeypatch.setattr(settings, "public_app_url",
                        "https://binhopper-git-staging-garrib11.vercel.app")
    response = client.post(SIGN_OUT, headers={"X-Binhopper-CSRF": "1", "Origin": origin})
    assert response.status_code == (204 if allowed else 403)


def test_reads_are_not_affected(client):
    assert client.get("/api/auth/providers").status_code == 200
