"""Connect Discogs and start an import (SPEC.md › Discogs import; #44).

The OAuth handshake runs here because the user is redirected to Discogs and back;
the import itself is queued for the worker (app/discogs_import.py).
"""

from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import delete_where, get_session
from app.discogs import RequestQueue
from app.discogs_oauth import AUTHORIZE_URL, DiscogsOAuthError, access_token, configured, identity, request_token
from app.models import DiscogsAccount, ImportJob, ImportPending, User
from app.routers.stock import get_now
from app.sessions import current_user
from app.token_crypto import decrypt, encrypt

router = APIRouter(prefix="/api", tags=["discogs import"])

DB = Annotated[Session, Depends(get_session)]
Me = Annotated[User, Depends(current_user)]
Now = Annotated[datetime, Depends(get_now)]

FLOW_COOKIE, FLOW_LIFETIME = "bh_discogs", timedelta(minutes=15)


def get_discogs_queue(db: DB) -> Iterator[RequestQueue]:
    """The shared quota-aware Discogs client (tests replace it with a fake transport)."""
    queue = RequestQueue(db, settings.discogs_token, settings.discogs_user_agent)
    try:
        yield queue
    finally:
        queue.close()


Queue = Annotated[RequestQueue, Depends(get_discogs_queue)]


class ImportChoice(BaseModel):
    collection: bool = True
    wantlist: bool = True

    @model_validator(mode="after")
    def something(self):
        if not (self.collection or self.wantlist):
            raise ValueError("Choose your collection, your wantlist or both")
        return self


def job_view(db: Session, job: ImportJob | None) -> dict | None:
    if job is None:
        return None
    pending = db.scalar(select(func.count()).select_from(ImportPending).where(ImportPending.job_id == job.id))
    return {"id": job.id, "status": job.status, "added": job.added, "wishlisted": job.wishlisted,
            "skipped": job.skipped, "looking_up": pending or 0, "not_found": job.unmatched,
            "error": job.error, "created_at": job.created_at, "finished_at": job.finished_at}


def latest_job(db: Session, user: User) -> ImportJob | None:
    return db.scalar(select(ImportJob).where(ImportJob.user_id == user.id)
                     .order_by(ImportJob.id.desc()).limit(1))


@router.get("/me/import/discogs")
def import_status(user: Me, db: DB):
    account = db.get(DiscogsAccount, user.id)
    return {"configured": configured(), "connected": account is not None,
            "username": account.username if account else None,
            "job": job_view(db, latest_job(db, user))}


@router.post("/me/import/discogs", status_code=202)
def start_import(body: ImportChoice, user: Me, db: DB, now: Now):
    if db.get(DiscogsAccount, user.id) is None:
        raise HTTPException(409, "Connect your Discogs account first")
    current = latest_job(db, user)
    if current is not None and current.status in ("queued", "running"):
        raise HTTPException(409, "An import is already running")
    job = ImportJob(user_id=user.id, status="queued", created_at=now,
                    collection_page=1 if body.collection else None,
                    wantlist_page=1 if body.wantlist else None,
                    added=0, wishlisted=0, skipped=0, unmatched=0)
    db.add(job)
    db.commit()
    return job_view(db, job)


@router.delete("/me/discogs", status_code=204)
def disconnect(user: Me, db: DB):
    """Remove the stored tokens (SPEC › Connected accounts) and stop any running import."""
    for job in db.scalars(select(ImportJob).where(ImportJob.user_id == user.id,
                                                  ImportJob.status.in_(["queued", "running"]))):
        job.status, job.error = "failed", "Discogs was disconnected"
    account = db.get(DiscogsAccount, user.id)
    if account is not None:
        db.delete(account)
    db.commit()
    return Response(status_code=204)


def failed() -> RedirectResponse:
    response = RedirectResponse("/import?error=discogs", status_code=302)
    response.delete_cookie(FLOW_COOKIE, path="/api/discogs")
    return response


@router.get("/discogs/connect")
def connect(request: Request, user: Me, queue: Queue):
    if not configured():
        raise HTTPException(404, "Discogs import isn't set up")
    try:
        token, secret = request_token(queue, f"{settings.public_app_url}/api/discogs/callback")
    except (DiscogsOAuthError, httpx.HTTPError):
        return failed()
    response = RedirectResponse(f"{AUTHORIZE_URL}?oauth_token={token}", status_code=302)
    # Ties the flow to this browser and account; the request secret never leaves the server unencrypted.
    response.set_cookie(FLOW_COOKIE, encrypt(f"{user.id}|{token}|{secret}"), path="/api/discogs",
                        max_age=int(FLOW_LIFETIME.total_seconds()), httponly=True, samesite="lax",
                        secure=request.url.scheme == "https")
    return response


@router.get("/discogs/callback")
def callback(request: Request, user: Me, db: DB, now: Now, queue: Queue,
             oauth_token: Annotated[str | None, Query(max_length=200)] = None,
             oauth_verifier: Annotated[str | None, Query(max_length=200)] = None):
    if not configured():
        return failed()
    flow = decrypt(request.cookies.get(FLOW_COOKIE, ""), max_age=int(FLOW_LIFETIME.total_seconds()))
    parts = flow.split("|") if flow else []
    if len(parts) != 3 or parts[0] != str(user.id) or parts[1] != oauth_token or not oauth_verifier:
        return failed()  # denied on Discogs, expired, or started in another browser/account
    try:
        token, secret = access_token(queue, parts[1], parts[2], oauth_verifier)
        username = identity(queue, token, secret)
    except (DiscogsOAuthError, httpx.HTTPError, ValueError):
        return failed()
    account = db.get(DiscogsAccount, user.id) or DiscogsAccount(user_id=user.id)
    account.username, account.token_enc, account.secret_enc = username, encrypt(token), encrypt(secret)
    account.connected_at = now
    db.add(account)
    db.commit()
    response = RedirectResponse("/import?connected=1", status_code=302)
    response.delete_cookie(FLOW_COOKIE, path="/api/discogs")
    return response


def forget_discogs(db: Session, user: User) -> None:
    """Account deletion: tokens, jobs and pending lookups go too."""
    job_ids = list(db.scalars(select(ImportJob.id).where(ImportJob.user_id == user.id)))
    if job_ids:
        delete_where(db, ImportPending, ImportPending.job_id.in_(job_ids))
        delete_where(db, ImportJob, ImportJob.id.in_(job_ids))
    account = db.get(DiscogsAccount, user.id)
    if account is not None:
        db.delete(account)
