"""Sign-up, sign-in and password reset (SPEC.md › Privacy › Sign-in; #38).

Rules that keep accounts private:
- Sign-up, forgot-password and resend always answer 202 with the same body, and
  sign-in gives one 401 for an unknown email or a wrong password (AC-20).
- Emailed links carry the token in the URL fragment, so it never reaches server
  logs; the page POSTs it here. Each link works once (AC-19, AC-21).
- New accounts start with profile, collection and wishlist set to "Only me" (AC-13).
"""

import hmac
import re
import secrets
import string
from datetime import datetime, timedelta
from html import escape
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_session
from app.google_oidc import GoogleOIDC, GoogleSignInError, get_google
from app.mailer import send_email
from app.models import AuthToken, OAuthState, User, UserSession, UserSettings
from app.passwords import (
    hash_password,
    needs_rehash,
    new_token,
    password_problem,
    token_hash,
    verify_password,
)
from app.rate_limit import Limit, client_ip
from app.routers.stock import get_now
from app.sessions import clear_session_cookie, end_session, optional_user, start_session

router = APIRouter(prefix="/api/auth", tags=["auth"])

DB = Annotated[Session, Depends(get_session)]
Now = Annotated[datetime, Depends(get_now)]

VERIFY, RESET = "verify_email", "reset_password"
TOKEN_LIFETIME = {VERIFY: timedelta(hours=24), RESET: timedelta(hours=1)}
OAUTH_COOKIE, OAUTH_LIFETIME = "bh_oauth", timedelta(minutes=10)

CHECK_EMAIL = {"detail": "Check your email for a link to finish signing up."}
RESET_SENT = {"detail": "If that email has a Binhopper account, we've sent a link to reset "
                        "the password."}
RESENT = {"detail": "If that email is waiting to be confirmed, we've sent a new link."}
BAD_CREDENTIALS = "Email or password is incorrect"
BAD_LINK = "This link has expired or was already used"

# Per-IP limits answer 429. Per-email limits on the 202 endpoints are silent (no email
# is sent, the response is unchanged), so they can't reveal whether an account exists.
REGISTER_IP = Limit("register-ip", 5, timedelta(hours=1))
REGISTER_EMAIL = Limit("register-email", 3, timedelta(hours=1))
SIGN_IN_IP = Limit("sign-in-ip", 20, timedelta(minutes=15))  # failed attempts
SIGN_IN_EMAIL = Limit("sign-in-email", 5, timedelta(minutes=15))  # failed attempts
RESEND_IP = Limit("resend-ip", 10, timedelta(hours=1))
RESEND_EMAIL = Limit("resend-email", 3, timedelta(hours=1))
FORGOT_IP = Limit("forgot-ip", 10, timedelta(hours=1))
FORGOT_EMAIL = Limit("forgot-email", 3, timedelta(hours=1))
TOKEN_IP = Limit("token-ip", 20, timedelta(minutes=15))

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailBody(BaseModel):
    email: str = Field(max_length=320)


class Credentials(EmailBody):
    password: str = Field(max_length=4096)


class TokenBody(BaseModel):
    token: str = Field(max_length=200)


class ResetBody(TokenBody):
    password: str = Field(max_length=4096)


def normalized(email: str) -> str:
    email = email.strip().lower()
    if len(email) > 254 or not EMAIL_PATTERN.match(email):
        raise HTTPException(422, "Enter a valid email address")
    return email


def check_password(password: str, email: str) -> None:
    if problem := password_problem(password, email):
        raise HTTPException(422, problem)


def limit_ip(db: Session, limit: Limit, request: Request, now: datetime) -> None:
    if limit.hit(db, client_ip(request), now):
        raise limit.too_many(now)


def me(user: User) -> dict:
    methods = [m for m, has in (("password", user.password_hash), ("google", user.google_sub)) if has]
    return {"id": user.id, "username": user.username, "email": user.email,
            "email_verified": user.email_verified_at is not None, "sign_in_methods": methods}


def new_user(db: Session, email: str, now: datetime, **fields) -> User:
    """A new account with an auto-generated username and every privacy setting "Only me"."""
    alphabet = string.ascii_lowercase + string.digits
    for _ in range(5):
        username = "collector-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if db.scalar(select(User.id).where(User.username == username)) is None:
            break
    user = User(username=username, email=email, created_at=now, **fields)
    user.settings = UserSettings(privacy_profile="private", privacy_collection="private",
                                 privacy_wishlist="private")
    db.add(user)
    db.flush()
    return user


def issue_link(db: Session, user: User, purpose: str, now: datetime) -> str:
    """A single-use emailed link. Any older unused link for the same purpose stops working."""
    db.execute(delete(AuthToken).where(AuthToken.user_id == user.id, AuthToken.purpose == purpose,
                                       AuthToken.used_at.is_(None)))
    token = new_token()
    db.add(AuthToken(user_id=user.id, purpose=purpose, token_hash=token_hash(token),
                     created_at=now, expires_at=now + TOKEN_LIFETIME[purpose]))
    page = "verify" if purpose == VERIFY else "reset-password"
    return f"{settings.public_app_url}/{page}#token={token}"


def use_link(db: Session, token: str, purpose: str, now: datetime) -> User | None:
    """Mark a link used and return its user, or None if it's unknown, expired or used."""
    row = db.scalar(select(AuthToken).where(AuthToken.token_hash == token_hash(token),
                                            AuthToken.purpose == purpose))
    if row is None or row.expires_at <= now:
        return None
    # Conditional update, so two clicks at once can't both use the link.
    claimed = db.execute(update(AuthToken).where(AuthToken.id == row.id,
                                                 AuthToken.used_at.is_(None))
                         .values(used_at=now)).rowcount
    return db.get(User, row.user_id) if claimed == 1 else None


# --- Emails -------------------------------------------------------------------------

def email_message(to: str, subject: str, paragraphs: list[str], link_label: str, link: str,
                  footer: str) -> tuple[str, str, str, str]:
    text = "\n\n".join([*paragraphs, f"{link_label}: {link}", footer])
    html = "".join(f"<p>{escape(p)}</p>" for p in paragraphs)
    html += f'<p><a href="{escape(link)}">{escape(link_label)}</a></p><p>{escape(footer)}</p>'
    return to, subject, text, html


def verify_email(to: str, link: str):
    return email_message(to, "Confirm your email for Binhopper",
                         ["Welcome to Binhopper. Confirm your email to finish signing up."],
                         "Confirm your email", link,
                         "This link works once and expires in 24 hours. If you didn't sign up, "
                         "you can ignore this email.")


def already_registered_email(to: str):
    return email_message(to, "You already have a Binhopper account",
                         ["Someone (hopefully you) tried to sign up with this email, but it "
                          "already has a Binhopper account. Sign in, or reset your password if "
                          "you've forgotten it."],
                         "Reset your password", f"{settings.public_app_url}/forgot-password",
                         f"Sign in: {settings.public_app_url}/sign-in. If this wasn't you, you "
                         "can ignore this email.")


def reset_email(to: str, link: str):
    return email_message(to, "Reset your Binhopper password",
                         ["Someone (hopefully you) asked to reset your Binhopper password."],
                         "Choose a new password", link,
                         "This link works once and expires in 1 hour. If you didn't ask, you "
                         "can ignore this email; your password hasn't changed.")


def google_only_email(to: str):
    return email_message(to, "You sign in to Binhopper with Google",
                         ["Someone (hopefully you) asked to reset your Binhopper password, but "
                          "your account signs in with Google, so there's no password to reset."],
                         "Sign in with Google", f"{settings.public_app_url}/sign-in",
                         "If this wasn't you, you can ignore this email.")


# --- Email + password -----------------------------------------------------------------

@router.post("/register", status_code=202)
def register(body: Credentials, request: Request, background: BackgroundTasks, db: DB, now: Now):
    limit_ip(db, REGISTER_IP, request, now)
    email = normalized(body.email)
    check_password(body.password, email)
    password_hash = hash_password(body.password)  # hashed either way, so timing matches
    if REGISTER_EMAIL.hit(db, email, now):
        return CHECK_EMAIL
    user = db.scalar(select(User).where(User.email == email))
    if user is not None:
        background.add_task(send_email, *already_registered_email(email))
        return CHECK_EMAIL
    try:
        user = new_user(db, email, now, auth_provider="email", password_hash=password_hash,
                        password_changed_at=now)
        link = issue_link(db, user, VERIFY, now)
        db.commit()
    except IntegrityError:  # the same email registered at the same moment
        db.rollback()
        return CHECK_EMAIL
    background.add_task(send_email, *verify_email(email, link))
    return CHECK_EMAIL


@router.post("/verify")
def verify(body: TokenBody, request: Request, response: Response, db: DB, now: Now):
    limit_ip(db, TOKEN_IP, request, now)
    user = use_link(db, body.token, VERIFY, now)
    if user is None:
        db.rollback()
        raise HTTPException(400, BAD_LINK)
    user.email_verified_at = user.email_verified_at or now
    start_session(db, user, request, response, now)
    return me(user)


@router.post("/resend-verification", status_code=202)
def resend_verification(body: EmailBody, request: Request, background: BackgroundTasks,
                        db: DB, now: Now):
    limit_ip(db, RESEND_IP, request, now)
    email = normalized(body.email)
    if RESEND_EMAIL.hit(db, email, now):
        return RESENT
    user = db.scalar(select(User).where(User.email == email))
    if user is not None and user.email_verified_at is None and user.password_hash:
        link = issue_link(db, user, VERIFY, now)
        db.commit()
        background.add_task(send_email, *verify_email(email, link))
    return RESENT


@router.post("/sign-in")
def sign_in(body: Credentials, request: Request, response: Response, db: DB, now: Now):
    ip = client_ip(request)
    email = body.email.strip().lower()
    for limit, key in ((SIGN_IN_IP, ip), (SIGN_IN_EMAIL, email)):
        if limit.exceeded(db, key, now):
            raise limit.too_many(now)
    user = db.scalar(select(User).where(User.email == email))
    # An unknown email still checks a (dummy) hash, so it answers as slowly as a wrong password.
    if not verify_password(user.password_hash if user else None, body.password):
        SIGN_IN_IP.record(db, ip, now)
        SIGN_IN_EMAIL.record(db, email, now)
        raise HTTPException(401, BAD_CREDENTIALS)
    if user.email_verified_at is None:
        # Only someone who knows the password learns the account exists.
        raise HTTPException(403, "verify_email")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
    start_session(db, user, request, response, now)
    return me(user)


@router.post("/sign-out", status_code=204)
def sign_out(request: Request, db: DB):
    end_session(db, request)
    db.commit()
    response = Response(status_code=204)
    clear_session_cookie(response, request)
    return response


@router.post("/forgot-password", status_code=202)
def forgot_password(body: EmailBody, request: Request, background: BackgroundTasks,
                    db: DB, now: Now):
    limit_ip(db, FORGOT_IP, request, now)
    email = normalized(body.email)
    if FORGOT_EMAIL.hit(db, email, now):
        return RESET_SENT
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        return RESET_SENT
    if user.password_hash is None and user.google_sub:
        background.add_task(send_email, *google_only_email(email))
        return RESET_SENT
    link = issue_link(db, user, RESET, now)
    db.commit()
    background.add_task(send_email, *reset_email(email, link))
    return RESET_SENT


@router.post("/reset-password")
def reset_password(body: ResetBody, request: Request, response: Response, db: DB, now: Now):
    limit_ip(db, TOKEN_IP, request, now)
    user = use_link(db, body.token, RESET, now)
    if user is None:
        db.rollback()
        raise HTTPException(400, BAD_LINK)
    if problem := password_problem(body.password, user.email):
        db.rollback()  # the link stays usable for a better password
        raise HTTPException(422, problem)
    user.password_hash, user.password_changed_at = hash_password(body.password), now
    # Following the link proves the mailbox, so an unconfirmed account is now confirmed.
    user.email_verified_at = user.email_verified_at or now
    # Sign out everywhere (AC-21): someone who knew the old password loses access.
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    start_session(db, user, request, response, now)
    return me(user)


@router.get("/me")
def current(user: Annotated[User | None, Depends(optional_user)]):
    if user is None:
        raise HTTPException(401, "Not signed in")
    return me(user)


@router.get("/providers")
def providers(google: Annotated[GoogleOIDC | None, Depends(get_google)]):
    return {"google": google is not None}


# --- Google -------------------------------------------------------------------------

def safe_return_to(value: str | None) -> str:
    """Only paths on this site, so the redirect after sign-in can't leave Binhopper."""
    if (not value or not value.startswith("/") or value.startswith("//") or "\\" in value
            or any(ord(c) < 32 for c in value) or len(value) > 500):
        return "/search"
    return value


def google_redirect_uri() -> str:
    return f"{settings.public_app_url}/api/auth/google/callback"


def google_failed(request: Request) -> RedirectResponse:
    response = RedirectResponse("/sign-in?error=google", status_code=302)
    response.delete_cookie(OAUTH_COOKIE, path="/api/auth/google")
    return response


@router.get("/google/start")
def google_start(request: Request, db: DB, now: Now,
                 google: Annotated[GoogleOIDC | None, Depends(get_google)],
                 return_to: Annotated[str | None, Query(max_length=500)] = None):
    if google is None:
        raise HTTPException(404, "Google sign-in isn't set up")
    db.execute(delete(OAuthState).where(OAuthState.expires_at <= now))
    state, nonce, verifier = new_token(), new_token(), new_token()
    db.add(OAuthState(state_hash=token_hash(state), code_verifier=verifier, nonce=nonce,
                      return_to=safe_return_to(return_to), expires_at=now + OAUTH_LIFETIME))
    db.commit()
    response = RedirectResponse(google.authorization_url(google_redirect_uri(), state, nonce,
                                                         verifier), status_code=302)
    # Binds the flow to this browser, so nobody can finish it in someone else's (login CSRF).
    response.set_cookie(OAUTH_COOKIE, state, max_age=int(OAUTH_LIFETIME.total_seconds()),
                        path="/api/auth/google", httponly=True, samesite="lax",
                        secure=request.url.scheme == "https")
    return response


def google_account(db: Session, claims: dict, now: datetime) -> User:
    sub, email = str(claims["sub"]), str(claims["email"]).strip().lower()
    user = db.scalar(select(User).where(User.google_sub == sub))
    if user is not None:
        return user
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        return new_user(db, email, now, auth_provider="google", google_sub=sub,
                        email_verified_at=now)
    if user.email_verified_at is None:
        # Someone may have signed up with this address without owning it. Google has
        # proven who owns it, so their password and any sessions stop working.
        user.password_hash = None
        db.execute(delete(UserSession).where(UserSession.user_id == user.id))
        db.execute(delete(AuthToken).where(AuthToken.user_id == user.id))
        user.email_verified_at = now
    user.google_sub = sub
    return user


@router.get("/google/callback")
def google_callback(request: Request, db: DB, now: Now,
                    google: Annotated[GoogleOIDC | None, Depends(get_google)],
                    code: Annotated[str | None, Query(max_length=2000)] = None,
                    state: Annotated[str | None, Query(max_length=200)] = None):
    cookie = request.cookies.get(OAUTH_COOKIE, "")
    if google is None or not code or not state or not hmac.compare_digest(cookie, state):
        return google_failed(request)
    flow = db.scalar(select(OAuthState).where(OAuthState.state_hash == token_hash(state)))
    if flow is None:
        return google_failed(request)
    db.delete(flow)
    db.commit()
    if flow.expires_at <= now:
        return google_failed(request)
    try:
        claims = google.claims(code, flow.code_verifier, google_redirect_uri(), flow.nonce)
    except GoogleSignInError:
        return google_failed(request)
    try:
        user = google_account(db, claims, now)
        db.flush()
    except IntegrityError:
        db.rollback()
        return google_failed(request)
    response = RedirectResponse(flow.return_to, status_code=302)
    response.delete_cookie(OAUTH_COOKIE, path="/api/auth/google")
    start_session(db, user, request, response, now)
    return response
