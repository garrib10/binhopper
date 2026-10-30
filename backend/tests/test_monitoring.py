"""#84 Better Stack: worker heartbeat, log shipping and the database health check. All HTTP mocked."""
import json
import logging

import httpx
import pytest
from sqlalchemy.orm import Session

from app import monitoring, worker
from app.config import Settings, settings
from app.db import get_session
from app.main import app
from app.monitoring import BetterStackHandler, beat


def test_heartbeat_is_off_until_its_url_is_set(monkeypatch):
    calls = []
    monkeypatch.setattr(settings, "heartbeat_url", "")
    beat(get=lambda url, **_: calls.append(url))
    assert calls == []


def test_heartbeat_reports_success_and_failure(monkeypatch):
    calls = []
    monkeypatch.setattr(settings, "heartbeat_url", "https://uptime.example/api/v1/heartbeat/abc")
    beat(get=lambda url, **_: calls.append(url))
    beat(ok=False, get=lambda url, **_: calls.append(url))
    assert calls == ["https://uptime.example/api/v1/heartbeat/abc", "https://uptime.example/api/v1/heartbeat/abc/fail"]


def test_a_heartbeat_outage_never_stops_the_worker(monkeypatch):
    def down(url, **_):
        raise httpx.ConnectError("no route")
    warned = []
    monkeypatch.setattr(settings, "heartbeat_url", "https://uptime.example/hb")
    monkeypatch.setattr(monitoring.log, "warning", lambda msg, *args: warned.append(msg % args))
    beat(get=down)
    assert warned == ["Heartbeat not sent: ConnectError"]


class FakeQueue:
    def __init__(self, session):
        self.session = session


@pytest.mark.parametrize("fails", [False, True])
def test_each_worker_pass_sends_a_heartbeat(monkeypatch, session, fails):
    sent = []
    def drain(queue, now):
        if fails:
            raise RuntimeError("Discogs said no")
    monkeypatch.setattr(worker, "drain", drain)
    monkeypatch.setattr(worker, "beat", lambda ok=True: sent.append(ok))
    worker.tick(FakeQueue(session))
    assert sent == [not fails]


def handler_with(requests):
    client = httpx.Client(transport=httpx.MockTransport(lambda r: requests.append(r) or httpx.Response(202)))
    return BetterStackHandler("https://in.example.betterstackdata.com", "src-token", "api", client=client)


def test_warnings_and_errors_ship_with_the_token_in_a_header_only():
    requests = []
    handler = handler_with(requests)
    logger = logging.getLogger("app.example")
    logger.addHandler(handler)
    try:
        logger.info("routine")  # below WARNING: stays local
        try:
            raise ValueError("boom")
        except ValueError:
            logger.exception("Import job %s failed", 7)
    finally:
        logger.removeHandler(handler)
    assert len(requests) == 1
    body = json.loads(requests[0].content)
    assert requests[0].headers["Authorization"] == "Bearer src-token"
    assert "src-token" not in requests[0].content.decode()
    assert (body["level"], body["logger"], body["service"]) == ("error", "app.example", "api")
    assert body["message"].startswith("Import job 7 failed") and "ValueError: boom" in body["message"]


def test_the_http_clients_own_logs_never_loop_back():
    requests = []
    handler = handler_with(requests)
    handler.handle(logging.makeLogRecord({"name": "httpx", "levelno": logging.WARNING, "levelname": "WARNING", "msg": "x"}))
    assert requests == []


def test_a_logging_outage_never_raises():
    def down(request):
        raise httpx.ConnectError("no route")
    handler = BetterStackHandler("https://in.example", "t", "api", client=httpx.Client(transport=httpx.MockTransport(down)))
    handler.emit(logging.makeLogRecord({"name": "app", "levelno": logging.ERROR, "levelname": "ERROR", "msg": "x"}))


def test_log_shipping_is_off_without_both_settings(monkeypatch):
    monkeypatch.setattr(settings, "logs_ingest_url", "https://in.example")
    monkeypatch.setattr(settings, "logs_source_token", "")
    before = list(logging.getLogger().handlers)
    monitoring.setup_logging("api")
    assert logging.getLogger().handlers == before


def test_no_monitoring_secret_has_a_default():
    fresh = Settings(_env_file=None)
    assert (fresh.heartbeat_url, fresh.logs_ingest_url, fresh.logs_source_token) == ("", "", "")


def test_database_health_check(client):
    assert client.get("/api/health/db").json() == {"status": "ok"}


def test_database_health_check_reports_an_outage(client):
    class Down(Session):
        def execute(self, *args, **kwargs):
            raise RuntimeError("MySQL is asleep")
    app.dependency_overrides[get_session] = lambda: Down()
    response = client.get("/api/health/db")
    assert (response.status_code, response.json()) == (503, {"status": "database unavailable"})


def test_monitors_reach_the_database_check_without_the_proxy_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "origin_secret", "s3cret")
    assert client.get("/api/health/db").status_code == 200
    assert client.get("/api/search?q=ru").status_code == 403
