"""send_email backends (#38). Resend is faked with an httpx MockTransport."""

import json

import httpx
import pytest

from app import mailer
from app.config import settings
from app.mailer import RESEND_URL, send_email

MESSAGE = ("collector@example.com", "Confirm your email", "Link: http://x/verify#token=t",
           "<p>Link</p>")


def test_memory_backend_keeps_messages(monkeypatch):
    send_email(*MESSAGE)
    assert mailer.outbox == [dict(zip(["to", "subject", "text", "html"], MESSAGE, strict=True))]


def test_log_backend_prints_the_link(monkeypatch, capsys):
    monkeypatch.setattr(settings, "email_backend", "log")
    send_email(*MESSAGE)
    assert "/verify#token=t" in capsys.readouterr().err


def test_file_backend_writes_json(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "email_backend", "file")
    monkeypatch.setattr(settings, "email_file_dir", str(tmp_path / "outbox"))
    send_email(*MESSAGE)
    [written] = (tmp_path / "outbox").iterdir()
    assert json.loads(written.read_text())["subject"] == "Confirm your email"


@pytest.fixture
def resend(monkeypatch):
    monkeypatch.setattr(settings, "email_backend", "resend")
    monkeypatch.setattr(settings, "resend_api_key", "re_test_key")
    monkeypatch.setattr(settings, "email_from", "Binhopper <onboarding@resend.dev>")


@pytest.mark.usefixtures("resend")
def test_resend_backend_posts_the_message():
    sent = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return httpx.Response(200, json={"id": "email-1"})

    send_email(*MESSAGE, transport=httpx.MockTransport(handler))
    [request] = sent
    assert str(request.url) == RESEND_URL
    assert request.headers["authorization"] == "Bearer re_test_key"
    body = json.loads(request.content)
    assert body == {"from": "Binhopper <onboarding@resend.dev>", "to": ["collector@example.com"],
                    "subject": "Confirm your email", "text": MESSAGE[2], "html": MESSAGE[3]}


@pytest.mark.usefixtures("resend")
def test_a_failed_send_is_logged_without_the_address(caplog):
    # e.g. Resend's test sender refusing anyone but the account owner.
    send_email(*MESSAGE, transport=httpx.MockTransport(lambda r: httpx.Response(403)))
    assert "failed" in caplog.text and "example.com" in caplog.text
    assert "collector@" not in caplog.text


def test_AC_20_a_failed_send_does_not_change_the_answer(client, monkeypatch):
    monkeypatch.setattr(settings, "email_backend", "resend")
    monkeypatch.setattr(mailer, "httpx", None)  # any send attempt raises
    response = client.post("/api/auth/register", headers={"X-Binhopper-CSRF": "1"},
                           json={"email": "collector@example.com", "password": "spin-the-b-side"})
    assert response.status_code == 202
