"""You: settings, privacy, your data and account deletion (SPEC.md › Account settings; #42)."""

import csv
import io
import json
import re
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.orm import Session, joinedload

from app.db import delete_where, get_session
from app.models import (
    Album, AuthToken, CollectionItem, DiscogsAccount, ImportJob, Pressing, StockReport, User, UserSession, UserSettings,
    WishlistItem, ZipCode,
)
from app.routers.discogs_import import forget_discogs
from app.routers.stock import get_now
from app.sessions import clear_session_cookie, current_user

router = APIRouter(prefix="/api/me", tags=["account"])

DB = Annotated[Session, Depends(get_session)]
Me = Annotated[User, Depends(current_user)]
Now = Annotated[datetime, Depends(get_now)]

# The genres in Onboarding/You (mockups); stored as the user's favorites.
GENRES = ["Rock", "Jazz", "Soul & Funk", "Hip-Hop", "Electronic", "Folk", "Country", "Reggae",
          "Classical", "Metal", "Latin", "Blues"]
USERNAME = re.compile(r"^[a-z0-9_-]{3,30}$")
# v1 offers Everyone / Only me; Friends comes with the social features (SPEC › Account rule 5).
Visibility = Literal["public", "private"]


class SettingsChange(BaseModel):
    """Only the fields sent are changed."""

    username: str | None = None
    home_zip: str | None = Field(default=None, pattern=r"^\d{5}$")
    default_radius_mi: Literal[10, 25, 50, 100] | None = None
    theme: Literal["light", "dark", "system"] | None = None
    use_current_location: bool | None = None
    privacy_profile: Visibility | None = None
    privacy_collection: Visibility | None = None
    privacy_wishlist: Visibility | None = None
    favorite_genres: list[str] | None = None

    @field_validator("username")
    @classmethod
    def a_username(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().lower()
        if not USERNAME.match(value):
            raise ValueError("Use 3–30 lowercase letters, numbers, _ or -")
        return value

    @field_validator("favorite_genres")
    @classmethod
    def known_genres(cls, value: list[str] | None) -> list[str] | None:
        if value is not None and any(g not in GENRES for g in value):
            raise ValueError(f"Choose from: {', '.join(GENRES)}")
        return list(dict.fromkeys(value)) if value is not None else None


def user_settings(db: Session, user: User) -> UserSettings:
    prefs = db.get(UserSettings, user.id)
    if prefs is None:  # accounts made before settings rows existed
        prefs = UserSettings(user_id=user.id, privacy_profile="private",
                             privacy_collection="private", privacy_wishlist="private")
        db.add(prefs)
        db.flush()
    return prefs


def view(user: User, prefs: UserSettings) -> dict:
    return {
        "username": user.username, "email": user.email,
        "sign_in_methods": [m for m, has in (("password", user.password_hash),
                                             ("google", user.google_sub)) if has],
        "home_zip": user.home_zip, "default_radius_mi": user.default_radius_mi, "theme": user.theme,
        "use_current_location": prefs.use_current_location,
        "privacy_profile": prefs.privacy_profile, "privacy_collection": prefs.privacy_collection,
        "privacy_wishlist": prefs.privacy_wishlist,
        "favorite_genres": prefs.favorite_genres or [],
        "genres": GENRES,
    }


@router.get("/settings")
def get_settings(user: Me, db: DB):
    prefs = user_settings(db, user)
    db.commit()
    return view(user, prefs)


@router.patch("/settings")
def change_settings(body: SettingsChange, user: Me, db: DB):
    prefs = user_settings(db, user)
    changes = body.model_dump(exclude_unset=True)
    if changes.get("username") and changes["username"] != user.username:
        if db.scalar(select(User.id).where(User.username == changes["username"])) is not None:
            raise HTTPException(409, "That username is taken")
    if changes.get("home_zip") and db.get(ZipCode, changes["home_zip"]) is None:
        raise HTTPException(422, "We don't have that ZIP yet. Check it or try a nearby one.")
    for field, value in changes.items():
        if value is None and field in {"username", "default_radius_mi", "theme"}:
            continue  # required on the account; ignore an explicit null
        setattr(user if hasattr(User, field) else prefs, field, value)
    db.commit()
    return view(user, prefs)


def collection_rows(db: Session, user: User) -> list[CollectionItem]:
    return list(db.scalars(select(CollectionItem).where(CollectionItem.user_id == user.id).options(
        joinedload(CollectionItem.pressing).joinedload(Pressing.album).joinedload(Album.artist))
        .order_by(CollectionItem.added_at, CollectionItem.id)))


@router.get("/export")
def export_collection(user: Me, db: DB, now: Now):
    """Collection as CSV (SPEC › Account rule 5)."""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["Artist", "Album", "Year", "Pressing", "Label", "Format", "Media grade",
                     "Sleeve grade", "Price paid", "Bought at", "Notes", "Added"])
    for item in collection_rows(db, user):
        p, album = item.pressing, item.pressing.album
        writer.writerow([album.artist.name, album.title, album.year or "", p.variant_note or "",
                         p.label or "", p.format, item.media_grade or "", item.sleeve_grade or "",
                         f"{item.price_paid:.2f}" if item.price_paid is not None else "",
                         item.bought_at or "", item.notes or "", item.added_at.date().isoformat()])
    filename = f"binhopper-collection-{now.date().isoformat()}.csv"
    return Response(out.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/data")
def download_data(user: Me, db: DB, now: Now):
    """Everything we store about the user, as JSON (SPEC › Privacy › Data export)."""
    prefs = user_settings(db, user)
    wishlist = db.scalars(select(WishlistItem).where(WishlistItem.user_id == user.id)
                          .options(joinedload(WishlistItem.album).joinedload(Album.artist))).all()
    reports = db.scalars(select(StockReport).where(StockReport.user_id == user.id)).all()
    sessions = db.scalars(select(UserSession).where(UserSession.user_id == user.id)).all()
    discogs = db.get(DiscogsAccount, user.id)
    imports = db.scalars(select(ImportJob).where(ImportJob.user_id == user.id)).all()

    def when(value):
        return value.isoformat() if value else None

    data = {
        "exported_at": now.isoformat(),
        "account": {"username": user.username, "email": user.email, "created_at": when(user.created_at),
                    "email_verified_at": when(user.email_verified_at),
                    "sign_in_methods": view(user, prefs)["sign_in_methods"]},
        "settings": {k: v for k, v in view(user, prefs).items()
                     if k not in {"username", "email", "sign_in_methods", "genres"}},
        "wishlist": [{"album": w.album.title, "artist": w.album.artist.name, "pressing_id": w.pressing_id,
                      "max_price": float(w.max_price) if w.max_price is not None else None,
                      "min_condition": w.min_condition, "added": when(w.created_at)} for w in wishlist],
        "collection": [{"album": i.pressing.album.title, "artist": i.pressing.album.artist.name,
                        "pressing": i.pressing.variant_note or i.pressing.label or i.pressing.format,
                        "media_grade": i.media_grade, "sleeve_grade": i.sleeve_grade,
                        "price_paid": float(i.price_paid) if i.price_paid is not None else None,
                        "bought_at": i.bought_at, "notes": i.notes, "added": when(i.added_at)}
                       for i in collection_rows(db, user)],
        "stock_reports": [{"listing_id": r.listing_id, "result": r.result,
                           "reported_price": float(r.reported_price) if r.reported_price is not None else None,
                           "created_at": when(r.created_at)} for r in reports],
        "discogs": {"username": discogs.username, "connected_at": when(discogs.connected_at)} if discogs else None,
        "imports": [{"status": j.status, "added": j.added, "wishlisted": j.wishlisted, "skipped": j.skipped,
                     "created_at": when(j.created_at)} for j in imports],
        # Only when each signed-in browser was last used; no tokens, IPs or devices are stored.
        "sessions": [{"created_at": when(s.created_at), "last_seen_at": when(s.last_seen_at),
                      "expires_at": when(s.expires_at)} for s in sessions],
    }
    filename = f"binhopper-data-{now.date().isoformat()}.json"
    return Response(json.dumps(data, indent=2), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.delete("", status_code=204)
def delete_account(user: Me, request: Request, db: DB):
    """Delete the account and its data (AC-15). Stock reports stay, anonymized, for listing
    accuracy (SPEC › Privacy › Account deletion)."""
    db.execute(update(StockReport).where(StockReport.user_id == user.id).values(user_id=None))
    for model in (WishlistItem, CollectionItem, UserSession, AuthToken):
        delete_where(db, model, model.user_id == user.id)
    forget_discogs(db, user)  # tokens, import jobs, pending lookups
    db.delete(user)  # its settings row goes with it (cascade)
    db.commit()
    response = Response(status_code=204)
    clear_session_cookie(response, request)
    return response
