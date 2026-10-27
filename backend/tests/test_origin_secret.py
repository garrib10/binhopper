"""Only traffic from Vercel's /api proxy reaches the API when a secret is set (#122)."""

import pytest
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.config import Settings, settings
from app.main import app
from app.origin_secret import OriginSecretMiddleware

SEARCH = "/api/search"  # q shorter than 2 chars: 200 with empty results, no data needed


@pytest.fixture
def secret(monkeypatch):
    monkeypatch.setattr(settings, "origin_secret", "new-s3cret, old-s3cret")


def test_without_a_configured_secret_nothing_is_checked(client):
    # Local dev and the rest of the test suite run with no ORIGIN_SECRET.
    assert Settings(_env_file=None).origin_secret == ""
    assert client.get(SEARCH).status_code == 200


@pytest.mark.usefixtures("secret")
@pytest.mark.parametrize("headers", [{}, {"X-Origin-Secret": "wrong"}, {"X-Origin-Secret": ""},
                                     {"X-Origin-Secret": "new-s3cret, old-s3cret"}])
def test_direct_calls_without_the_secret_are_forbidden(client, headers):
    response = client.get(SEARCH, headers=headers)
    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}


@pytest.mark.usefixtures("secret")
@pytest.mark.parametrize("value", ["new-s3cret", "old-s3cret"])
def test_proxied_calls_with_either_rotation_secret_pass(client, value):
    assert client.get(SEARCH, headers={"X-Origin-Secret": value}).status_code == 200


@pytest.mark.usefixtures("secret")
def test_health_stays_open_for_railway_and_the_deploy_check(client):
    assert client.get("/api/health").status_code == 200


@pytest.mark.usefixtures("secret")
def test_non_api_paths_are_not_checked(client):
    assert client.get("/openapi.json").status_code == 200


def test_secret_check_runs_inside_the_proxy_header_middleware():
    assert [m.cls for m in app.user_middleware[:2]] == [ProxyHeadersMiddleware, OriginSecretMiddleware]
