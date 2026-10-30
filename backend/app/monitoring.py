"""Better Stack hooks (#84): the worker's heartbeat and shipping warnings and errors.

Both stay off unless their environment variables are set, and the tokens only ever come
from the environment (never the repo or the frontend). Shipped: WARNING and above from
the app and uvicorn's error logger, with tracebacks. Not shipped: access logs, so no
visitor IPs or paths leave Railway.
"""

import logging
import os
import queue
from datetime import UTC, datetime
from logging.handlers import QueueHandler, QueueListener

import httpx

from app.config import settings

log = logging.getLogger(__name__)
_listener: QueueListener | None = None


def beat(ok: bool = True, get=httpx.get) -> None:
    """Tell Better Stack the worker finished a pass (or failed one). Never raises."""
    url = settings.heartbeat_url
    if not url:
        return
    try:
        get(url if ok else f"{url.rstrip('/')}/fail", timeout=10)
    except httpx.HTTPError as exc:
        log.warning("Heartbeat not sent: %s", type(exc).__name__)


class BetterStackHandler(logging.Handler):
    """Posts each record to a Better Stack Logs source. Runs on the listener's thread."""

    def __init__(self, url: str, token: str, service: str, client: httpx.Client | None = None):
        super().__init__(level=logging.WARNING)
        self.url, self.service = url, service
        self.client = client or httpx.Client(timeout=5)
        self.auth = {"Authorization": f"Bearer {token}"}
        self.setFormatter(logging.Formatter("%(message)s"))
        # Our own HTTP client's records would loop back here.
        self.addFilter(lambda record: not record.name.startswith(("httpx", "httpcore")))

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self.client.post(self.url, headers=self.auth, json={
                "dt": datetime.fromtimestamp(record.created, UTC).isoformat(),
                "level": record.levelname.lower(), "logger": record.name,
                "service": self.service, "message": self.format(record)})
        except httpx.HTTPError:
            pass  # a logging outage must never take the app down, or log about itself


def setup_logging(service: str) -> None:
    """Ship warnings and errors when LOGS_INGEST_URL and LOGS_SOURCE_TOKEN are both set."""
    global _listener
    if _listener is not None or not (settings.logs_ingest_url and settings.logs_source_token):
        return
    records: queue.Queue = queue.Queue(-1)
    handler = BetterStackHandler(settings.logs_ingest_url, settings.logs_source_token,
                                 os.getenv("RAILWAY_SERVICE_NAME", service))
    _listener = QueueListener(records, handler, respect_handler_level=True)
    _listener.start()
    # Requests never wait on Better Stack: records go on a queue and post from a thread.
    for name in ("", "uvicorn"):
        target = logging.getLogger(name)
        queued = QueueHandler(records)
        queued.setLevel(logging.WARNING)
        if name:  # uvicorn's own logging config stops its records reaching the root; if not, the root ships them
            queued.addFilter(lambda _, logger=target: not logger.propagate)
        target.addHandler(queued)
        if target.level == logging.NOTSET or target.level > logging.WARNING:
            target.setLevel(logging.WARNING)
