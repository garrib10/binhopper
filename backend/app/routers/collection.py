"""Collection (SPEC.md › Collection; #41). Signed-in only, and only ever the user's own copies:
someone else's copy id answers 404, the same as one that doesn't exist (AC-13)."""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db import delete_where, get_session
from app.grades import GRADES
from app.models import Album, AlbumGenre, CollectionItem, Pressing, User, WishlistItem
from app.routers.search import fresh_image
from app.routers.stock import get_now
from app.sessions import current_user

router = APIRouter(prefix="/api/me/collection", tags=["collection"])

DB = Annotated[Session, Depends(get_session)]
Me = Annotated[User, Depends(current_user)]
Now = Annotated[datetime, Depends(get_now)]

DUPLICATE = "You already own this pressing"


class CopyDetails(BaseModel):
    """What the owner records about one copy (rule 2). Every field is optional."""

    media_grade: str | None = None
    sleeve_grade: str | None = None
    price_paid: float | None = Field(default=None, ge=0, le=100_000)
    bought_at: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("media_grade", "sleeve_grade")
    @classmethod
    def a_grade(cls, value: str | None) -> str | None:
        if value is not None and value not in GRADES:
            raise ValueError(f"must be one of {', '.join(reversed(GRADES))}")
        return value

    @field_validator("bought_at", "notes")
    @classmethod
    def blank_is_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class NewCopy(CopyDetails):
    pressing_id: int
    # Rule 3: a second copy of an owned pressing needs the user's "Add as 2nd copy".
    another_copy: bool = False


class CopyChange(CopyDetails):
    pressing_id: int


def leave_wishlist(db: Session, user_id: int, pressing: Pressing) -> dict:
    """Got a copy: drop the wishlist entries it satisfies (SPEC › Collection rule 6).

    An entry for "any pressing" or for this same pressing goes; an entry for a different,
    specific pressing stays, because the user still wants that version. Returns what
    happened, so the app can say so and keep the hearts right.
    """
    removed = delete_where(db, WishlistItem, WishlistItem.user_id == user_id,
                           WishlistItem.album_id == pressing.album_id,
                           or_(WishlistItem.pressing_id.is_(None), WishlistItem.pressing_id == pressing.id))
    still = db.scalar(select(WishlistItem.id).where(WishlistItem.user_id == user_id,
                                                    WishlistItem.album_id == pressing.album_id)) is not None
    return {"removed_from_wishlist": removed > 0, "album_on_wishlist": still}


def own_copy(db: Session, user: User, copy_id: int) -> CollectionItem:
    item = db.get(CollectionItem, copy_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(404, "Copy not found")
    return item


def copies_of(db: Session, user: User, pressing_id: int) -> list[int]:
    return list(db.scalars(select(CollectionItem.id).where(
        CollectionItem.user_id == user.id, CollectionItem.pressing_id == pressing_id)
        .order_by(CollectionItem.added_at, CollectionItem.id)))


def view(item: CollectionItem, copy_number: int, now: datetime) -> dict:
    pressing, album = item.pressing, item.pressing.album
    return {
        "id": item.id,
        "album": {"id": album.id, "title": album.title, "year": album.year,
                  "artist": {"id": album.artist.id, "name": album.artist.name},
                  "cover_url": fresh_image(album.cover_url, getattr(album, "cover_fetched_at", None), now)},
        "pressing": {"id": pressing.id, "note": pressing.variant_note or pressing.label or pressing.format,
                     "label": pressing.label, "format": pressing.format},
        "copy_number": copy_number,
        "media_grade": item.media_grade, "sleeve_grade": item.sleeve_grade,
        "price_paid": float(item.price_paid) if item.price_paid is not None else None,
        "bought_at": item.bought_at, "notes": item.notes, "added_at": item.added_at,
    }


def load_copies(db: Session, user: User) -> list[CollectionItem]:
    return list(db.scalars(select(CollectionItem).where(CollectionItem.user_id == user.id).options(
        joinedload(CollectionItem.pressing).joinedload(Pressing.album).joinedload(Album.artist))))


def copy_numbers(items: list[CollectionItem]) -> dict[int, int]:
    """Copy 1, 2, 3… of each pressing, in the order they were added."""
    numbers, seen = {}, {}
    for item in sorted(items, key=lambda i: (i.added_at, i.id)):
        seen[item.pressing_id] = seen.get(item.pressing_id, 0) + 1
        numbers[item.id] = seen[item.pressing_id]
    return numbers


@router.get("")
def list_collection(user: Me, db: DB, now: Now,
                    sort: Literal["recent", "artist", "genre", "year"] = "recent"):
    items = load_copies(db, user)
    numbers = copy_numbers(items)
    album_ids = {i.pressing.album_id for i in items}
    genres = {album_id: genre for album_id, genre in db.execute(
        select(AlbumGenre.album_id, func.min(AlbumGenre.genre))
        .where(AlbumGenre.album_id.in_(album_ids)).group_by(AlbumGenre.album_id))} if album_ids else {}

    def album(i: CollectionItem) -> Album:
        return i.pressing.album

    keys = {  # rule 4
        "artist": lambda i: (album(i).artist.name.lower(), album(i).title.lower(), i.id),
        "genre": lambda i: (genres.get(album(i).id) is None, (genres.get(album(i).id) or "").lower(),
                            album(i).artist.name.lower(), album(i).title.lower(), i.id),
        "year": lambda i: (album(i).year is None, album(i).year or 0, album(i).title.lower(), i.id),
    }
    if sort == "recent":
        items.sort(key=lambda i: (i.added_at, i.id), reverse=True)
    else:
        items.sort(key=keys[sort])
    rows = [{**view(i, numbers[i.id], now), "genre": genres.get(album(i).id)} for i in items]
    return {
        "sort": sort,
        "items": rows,
        "stats": {
            "records": len(items),
            "artists": len({album(i).artist.id for i in items}),
            "duplicates": sum(1 for n in numbers.values() if n > 1),
            "wishlist": db.scalar(select(func.count(WishlistItem.album_id.distinct()))
                                  .where(WishlistItem.user_id == user.id)) or 0,
        },
    }


@router.get("/owned")
def owned_pressings(user: Me, db: DB, album_id: Annotated[int, Query()]):
    """How many copies of each of an album's pressings the user owns (album page)."""
    rows = db.execute(select(CollectionItem.pressing_id, func.count()).join(CollectionItem.pressing)
                      .where(CollectionItem.user_id == user.id, Pressing.album_id == album_id)
                      .group_by(CollectionItem.pressing_id)).all()
    return {"album_id": album_id, "copies": {str(pid): count for pid, count in rows}}


@router.get("/{copy_id}")
def get_copy(copy_id: int, user: Me, db: DB, now: Now):
    item = own_copy(db, user, copy_id)
    number = copies_of(db, user, item.pressing_id).index(item.id) + 1
    album = db.scalar(select(Album).where(Album.id == item.pressing.album_id)
                      .options(selectinload(Album.pressings)))
    return {**view(item, number, now),
            "pressings": [{"id": p.id, "note": p.variant_note or p.label or p.format,
                           "detail": " · ".join(x for x in (p.label, p.format) if x)}
                          for p in sorted(album.pressings, key=lambda p: p.id)]}


@router.post("", status_code=201)
def add_copy(body: NewCopy, user: Me, db: DB, now: Now):
    pressing = db.get(Pressing, body.pressing_id)
    if pressing is None:
        raise HTTPException(404, "Pressing not found")
    owned = copies_of(db, user, pressing.id)
    if owned and not body.another_copy:
        # The app shows the warning and offers "Add as 2nd copy" (AC-09).
        raise HTTPException(409, {"message": DUPLICATE, "copies": len(owned)})
    item = CollectionItem(user_id=user.id, pressing_id=pressing.id, added_at=now,
                          **body.model_dump(exclude={"pressing_id", "another_copy"}))
    db.add(item)
    wishlist = leave_wishlist(db, user.id, pressing)
    db.commit()
    return {**view(item, len(owned) + 1, now), **wishlist}


@router.patch("/{copy_id}")
def change_copy(copy_id: int, body: CopyChange, user: Me, db: DB, now: Now):
    item = own_copy(db, user, copy_id)
    pressing = db.get(Pressing, body.pressing_id)
    if pressing is None or pressing.album_id != item.pressing.album_id:
        raise HTTPException(422, "That pressing isn't part of this album")
    for field, value in body.model_dump().items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return view(item, copies_of(db, user, item.pressing_id).index(item.id) + 1, now)


@router.delete("/{copy_id}", status_code=204)
def remove_copy(copy_id: int, user: Me, db: DB):
    db.delete(own_copy(db, user, copy_id))
    db.commit()
    return Response(status_code=204)
