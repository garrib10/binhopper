"""The API sits behind Vercel's /api proxy and Railway's edge (#117)."""

from collections.abc import Iterator

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.config import Settings, settings
from app.main import app

PROBE = "/api/_test/request-info"


@pytest.fixture
def probe(client: TestClient) -> Iterator[TestClient]:
    """Temporarily expose what the app sees as the client address and scheme."""

    @app.get(PROBE)
    def request_info(request: Request) -> dict[str, str]:
        return {"client": request.client.host, "scheme": request.url.scheme}

    yield client
    app.router.routes[:] = [r for r in app.router.routes if getattr(r, "path", None) != PROBE]


def test_forwarded_headers_set_client_ip_and_https(probe):
    # Vercel sets the visitor's IP first; Railway's edge appends its own hop.
    response = probe.get(PROBE, headers={
        "X-Forwarded-For": "203.0.113.7, 10.0.0.2", "X-Forwarded-Proto": "https",
    })
    assert response.json() == {"client": "203.0.113.7", "scheme": "https"}


def test_direct_requests_are_unchanged(probe):
    assert probe.get(PROBE).json() == {"client": "testclient", "scheme": "http"}


def test_proxy_headers_run_first_and_trust_the_configured_peers():
    outermost = app.user_middleware[0]
    assert outermost.cls is ProxyHeadersMiddleware
    assert outermost.kwargs == {"trusted_hosts": settings.forwarded_allow_ips}


def test_defaults_trust_any_peer_and_allow_cors_only_for_local_dev():
    defaults = Settings(_env_file=None)
    assert defaults.forwarded_allow_ips == "*"
    assert defaults.cors_origins == ["http://localhost:5173"]
