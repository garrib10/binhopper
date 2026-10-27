"""One durable, quota-aware request queue. Only app.worker talks to Discogs."""
from datetime import timedelta
import time
from urllib.parse import quote

import httpx
from sqlalchemy import delete, select

from app.models import CatalogJob, DiscogsCall, utcnow


class RequestQueue:
    def __init__(self, session, token, user_agent, *, transport=None, now=utcnow, sleep=time.sleep):
        self.session, self.now, self.sleep = session, now, sleep
        self.limit = 60 if token else 25
        self.remaining = None
        self.client = httpx.Client(base_url="https://api.discogs.com", timeout=20,
                                   headers={"User-Agent": user_agent,
                                            **({"Authorization": f"Discogs token={token}"} if token else {})},
                                   transport=transport, follow_redirects=False)

    def close(self):
        self.client.close()

    def reserve(self):
        while True:
            now = self.now()
            self.session.execute(delete(DiscogsCall).where(DiscogsCall.reserved_at < now - timedelta(seconds=61)))
            calls = self.session.scalars(select(DiscogsCall.reserved_at).where(
                DiscogsCall.reserved_at >= now - timedelta(seconds=60)).order_by(DiscogsCall.reserved_at)).all()
            if len(calls) < self.limit:
                self.session.add(DiscogsCall(reserved_at=now))
                self.session.commit()  # A failed request still consumes a reservation.
                return
            self.sleep(max(0.001, 60.001 - (now - calls[0]).total_seconds()))

    def get(self, kind, identifier):
        if kind not in {"artists", "masters", "releases"} or not isinstance(identifier, int) or identifier < 1:
            raise ValueError("Only positive catalog IDs are allowed")
        return self.request(f"/{kind}/{identifier}")

    def inventory(self, seller, page):
        if not seller or len(seller) > 120 or page < 1:
            raise ValueError("Invalid inventory request")
        return self.request(f"/users/{quote(seller, safe='')}/inventory",
                            params={"status": "For Sale", "per_page": 100, "page": page})

    def request(self, path, **kwargs):
        self.reserve()
        response = self.client.get(path, **kwargs)
        try:
            self.limit = min(self.limit, max(1, int(response.headers.get("X-Discogs-Ratelimit", self.limit))))
            self.remaining = int(response.headers.get("X-Discogs-Ratelimit-Remaining", "1"))
            used = int(response.headers.get("X-Discogs-Ratelimit-Used", "0"))
            if self.remaining <= 0 or used >= self.limit or response.status_code == 429:
                self.sleep(60.001)
        except ValueError:
            # Missing/malformed headers never lift our local cap, nor skip a 429 wait.
            if response.status_code == 429:
                self.sleep(60.001)
        response.raise_for_status()
        return response.json()


def enqueue(session, kind, identifier, *, now=utcnow):
    if kind not in {"artists", "masters", "releases"} or identifier < 1:
        raise ValueError("Invalid catalog job")
    existing = session.scalar(select(CatalogJob).where(CatalogJob.kind == kind,
                                                     CatalogJob.discogs_id == identifier))
    if existing is None:
        session.add(CatalogJob(kind=kind, discogs_id=identifier, next_fetch=now()))
        session.commit()
