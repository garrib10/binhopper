"""Sending email: one `send_email` call, with the backend picked by EMAIL_BACKEND.

- log: print the message (local development; the link is in the uvicorn output)
- file: write each message as JSON to EMAIL_FILE_DIR (the local system tests read it)
- memory: keep messages in `outbox` (pytest)
- resend: Resend's HTTP API (staging/production; RESEND_API_KEY lives only on the server)

A failed send is logged and never changes the API's response, so it can't reveal
whether an email has an account.
"""

import json
import logging
import sys
import time
from pathlib import Path

import httpx

from app.config import settings

RESEND_URL = "https://api.resend.com/emails"
log = logging.getLogger("binhopper.email")
outbox: list[dict[str, str]] = []


def send_email(to: str, subject: str, text: str, html: str,
               transport: httpx.BaseTransport | None = None) -> None:
    message = {"to": to, "subject": subject, "text": text, "html": html}
    try:
        match settings.email_backend:
            case "memory":
                outbox.append(message)
            case "log":
                print(f"--- Email to {to}: {subject}\n{text}\n---", file=sys.stderr)
            case "file":
                folder = Path(settings.email_file_dir)
                folder.mkdir(parents=True, exist_ok=True)
                name = f"{time.time_ns()}.json"
                (folder / name).write_text(json.dumps(message))
            case "resend":
                with httpx.Client(transport=transport, timeout=10) as client:
                    response = client.post(RESEND_URL, json={
                        "from": settings.email_from, "to": [to], "subject": subject,
                        "text": text, "html": html,
                    }, headers={"Authorization": f"Bearer {settings.resend_api_key}"})
                    response.raise_for_status()
    except Exception as exc:  # noqa: BLE001 (a lost email must not fail or reveal anything)
        log.error("Email to %s failed (%s): %s", to.split("@")[-1], subject, exc)
