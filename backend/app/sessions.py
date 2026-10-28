"""Cookie sessions: who is signed in (SPEC.md › Privacy › Sign-in).

The browser holds a random token in an HttpOnly, SameSite=Lax cookie set through the
app's own origin (Vercel's /api proxy, #117); the database stores only its hash.
"""

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import User, UserSession
from app.passwords import new_token, token_hash
from app.routers.stock import get_now

COOKIE = "bh_session"
LIFETIME = timedelta(days=30)
RENEW_BELOW = timedelta(days=15)  # sliding expiry: extend once half the lifetime is used


def set_session_cookie(response: Response, request: Request, token: str) -> None:
    # Secure follows the scheme the visitor used: https behind Vercel and Railway
    # (ProxyHeadersMiddleware applies X-Forwarded-Proto), http on localhost.
    response.set_cookie(COOKIE, token, max_age=int(LIFETIME.total_seconds()), path="/",
                        httponly=True, samesite="lax", secure=request.url.scheme == "https")


def clear_session_cookie(response: Response, request: Request) -> None:
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="lax",
                           secure=request.url.scheme == "https")


def end_session(db: Session, request: Request) -> None:
    """Delete the session the browser presented, if any."""
    token = request.cookies.get(COOKIE)
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == token_hash(token)))


def start_session(db: Session, user: User, request: Request, response: Response,
                  now: datetime) -> None:
    """Sign in with a fresh token (rotation: any session the browser had is ended)."""
    end_session(db, request)
    db.execute(delete(UserSession).where(UserSession.user_id == user.id,
                                         UserSession.expires_at <= now))
    token = new_token()
    db.add(UserSession(user_id=user.id, token_hash=token_hash(token), created_at=now,
                       expires_at=now + LIFETIME, last_seen_at=now))
    db.commit()
    set_session_cookie(response, request, token)


def optional_user(request: Request, response: Response,
                  db: Annotated[Session, Depends(get_session)],
                  now: Annotated[datetime, Depends(get_now)]) -> User | None:
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    row = db.scalar(select(UserSession).where(UserSession.token_hash == token_hash(token),
                                              UserSession.expires_at > now))
    if row is None:
        return None
    if row.expires_at - now < RENEW_BELOW:
        row.expires_at, row.last_seen_at = now + LIFETIME, now
        db.commit()
        set_session_cookie(response, request, token)
    return db.get(User, row.user_id)


def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    """Dependency for signed-in-only endpoints: 401 when signed out."""
    if user is None:
        raise HTTPException(401, "Sign in to continue")
    return user
