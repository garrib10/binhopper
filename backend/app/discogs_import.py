"""Discogs import, run by the worker (SPEC.md › Discogs import; #44).

Each pass fetches at most a few pages (100 releases each) per job, through the same
quota-aware queue as the catalog and inventory sync. Releases are matched by Discogs
release ID: a pressing the user already had before the import started is skipped
(AC-11). Releases not in the catalog yet are queued for a catalog lookup and finished
on a later pass ("looking up").
"""

import logging
import re
from datetime import datetime, timedelta
from urllib.parse import quote

import httpx
from sqlalchemy import select

from app.discogs import RequestQueue, enqueue
from app.discogs_oauth import header
from app.models import (
    CollectionItem, DiscogsAccount, ImportJob, ImportPending, Pressing, WishlistItem, utcnow,
)
from app.token_crypto import decrypt

log = logging.getLogger(__name__)

PAGES_PER_PASS = 5  # per job, so one big import can't starve the shop inventory sync
GIVE_UP_AFTER = timedelta(days=1)  # a release the catalog lookup never found
# Discogs' default collection fields: 1 = Media Condition, 2 = Sleeve Condition, 3 = Notes.
MEDIA, SLEEVE, NOTES = 1, 2, 3
GRADE = re.compile(r"\((M|NM|VG\+|VG|G\+|G|F|P)[\s)]")


def grade(text: str | None) -> str | None:
    """'Very Good Plus (VG+)' → 'VG+'; 'Near Mint (NM or M-)' → 'NM'; Fair counts as Poor."""
    match = GRADE.search(text or "")
    if not match:
        return None
    return "P" if match.group(1) == "F" else match.group(1)


def note_fields(item: dict) -> dict[int, str]:
    return {int(n["field_id"]): str(n.get("value") or "") for n in item.get("notes") or []
            if isinstance(n, dict) and "field_id" in n}


def add_to_collection(s, job: ImportJob, pressing: Pressing, media, sleeve, notes, now) -> None:
    owned_before = s.scalar(select(CollectionItem.id).where(
        CollectionItem.user_id == job.user_id, CollectionItem.pressing_id == pressing.id,
        CollectionItem.added_at < job.created_at))
    if owned_before is not None:
        job.skipped += 1  # AC-11: already in the app, so nothing gets doubled
        return
    s.add(CollectionItem(user_id=job.user_id, pressing_id=pressing.id, media_grade=media,
                         sleeve_grade=sleeve, notes=(notes or None) and notes[:2000], added_at=now))
    job.added += 1


def add_to_wishlist(s, job: ImportJob, pressing: Pressing, now) -> None:
    if s.scalar(select(WishlistItem.id).where(WishlistItem.user_id == job.user_id,
                                              WishlistItem.album_id == pressing.album_id)) is not None:
        job.skipped += 1
        return
    s.add(WishlistItem(user_id=job.user_id, album_id=pressing.album_id, pressing_id=pressing.id,
                       created_at=now))
    job.wishlisted += 1


def take(s, job: ImportJob, kind: str, release_id: int, media=None, sleeve=None, notes=None, now=None) -> None:
    pressing = s.scalar(select(Pressing).where(Pressing.discogs_release_id == release_id))
    if pressing is None:
        enqueue(s, "releases", release_id, now=lambda: now)
        s.add(ImportPending(job_id=job.id, kind=kind, release_id=release_id, media_grade=media,
                            sleeve_grade=sleeve, notes=notes, created_at=now))
    elif kind == "collection":
        add_to_collection(s, job, pressing, media, sleeve, notes, now)
    else:
        add_to_wishlist(s, job, pressing, now)


def fetch_page(queue: RequestQueue, account: DiscogsAccount, kind: str, page: int) -> dict:
    token, secret = decrypt(account.token_enc), decrypt(account.secret_enc)
    if not token or not secret:
        raise PermissionError("stored Discogs tokens can't be read")
    user = quote(account.username, safe="")
    path = (f"/users/{user}/collection/folders/0/releases" if kind == "collection" else f"/users/{user}/wants")
    return queue.request(path, params={"page": page, "per_page": 100},
                         headers={"Authorization": header(token, secret)})


def run_pages(queue: RequestQueue, job: ImportJob, account: DiscogsAccount, now: datetime) -> None:
    s = queue.session
    for kind, cursor, key in (("collection", "collection_page", "releases"), ("wantlist", "wantlist_page", "wants")):
        for _ in range(PAGES_PER_PASS):
            page = getattr(job, cursor)
            if page is None:
                break
            payload = fetch_page(queue, account, kind, page)
            for item in payload.get(key, []):
                fields = note_fields(item)
                if kind == "collection":
                    take(s, job, kind, int(item["id"]), grade(fields.get(MEDIA)), grade(fields.get(SLEEVE)),
                         fields.get(NOTES), now)
                else:
                    take(s, job, kind, int(item["id"]), now=now)
            pages = int(payload.get("pagination", {}).get("pages") or 0)
            setattr(job, cursor, page + 1 if page < pages else None)
            s.commit()


def settle_pending(s, job: ImportJob, now: datetime) -> None:
    """Finish releases the catalog lookup has found since; give up on ones it never finds."""
    for row in s.scalars(select(ImportPending).where(ImportPending.job_id == job.id)).all():
        pressing = s.scalar(select(Pressing).where(Pressing.discogs_release_id == row.release_id))
        if pressing is not None:
            if row.kind == "collection":
                add_to_collection(s, job, pressing, row.media_grade, row.sleeve_grade, row.notes, now)
            else:
                add_to_wishlist(s, job, pressing, now)
            s.delete(row)
        elif now - row.created_at > GIVE_UP_AFTER:
            job.unmatched += 1
            s.delete(row)
    s.commit()


def drain_imports(queue: RequestQueue, now=utcnow) -> None:
    s = queue.session
    jobs = s.scalars(select(ImportJob).where(ImportJob.status.in_(["queued", "running"]))
                     .order_by(ImportJob.id)).all()
    for job in jobs:
        account = s.get(DiscogsAccount, job.user_id)
        if account is None:
            job.status, job.error, job.finished_at = "failed", "Discogs was disconnected", now()
            s.commit()
            continue
        job.status = "running"
        try:
            run_pages(queue, job, account, now())
            settle_pending(s, job, now())
        except (PermissionError, httpx.HTTPStatusError) as exc:
            s.rollback()
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if isinstance(exc, PermissionError) or status in (401, 403):
                job.status, job.finished_at = "failed", now()
                job.error = "Discogs didn't accept the connection. Connect again, then retry."
            log.warning("Import job %s: %s", job.id, exc)  # other errors: retried next pass
        except httpx.HTTPError as exc:
            s.rollback()
            log.warning("Import job %s: %s; retrying next pass", job.id, exc)
        pending = s.scalar(select(ImportPending.id).where(ImportPending.job_id == job.id))
        if job.status == "running" and job.collection_page is None and job.wantlist_page is None and pending is None:
            job.status, job.finished_at = "done", now()
        s.commit()
