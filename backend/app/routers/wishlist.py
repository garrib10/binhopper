"""Wishlist (SPEC.md › Wishlist; #39). Signed-in only, and only ever the user's own items:
someone else's item id answers 404, the same as one that doesn't exist (AC-13)."""

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.db import get_session
from app.geo import ALLOWED_RADII_MI, display_miles, haversine_mi, within_radius
from app.inventory import visible_inventory
from app.models import Album, Pressing, StockListing, Store, User, WishlistItem, ZipCode, utcnow
from app.routers.search import fresh_image, visible
from app.routers.stock import get_now
from app.sessions import current_user

router = APIRouter(prefix="/api/me/wishlist", tags=["wishlist"])

DB = Annotated[Session, Depends(get_session)]
Me = Annotated[User, Depends(current_user)]
Now = Annotated[datetime, Depends(get_now)]

# Goldmine grades, worst to best. A "New" (sealed) copy counts as Mint.
GRADES = ["P", "G", "G+", "VG", "VG+", "NM", "M"]


class WishlistTarget(BaseModel):
    """Which copy counts: any or one pressing, plus an optional price cap and grade floor."""

    pressing_id: int | None = None
    max_price: float | None = Field(default=None, gt=0, le=100_000)
    min_condition: str | None = None


class NewItem(WishlistTarget):
    album_id: int


def grade_rank(condition: str) -> int | None:
    condition = condition.strip().upper()
    return GRADES.index("M") if condition == "NEW" else (
        GRADES.index(condition) if condition in GRADES else None)


def check_target(db: Session, album_id: int, target: WishlistTarget) -> None:
    if target.min_condition is not None and target.min_condition not in GRADES:
        raise HTTPException(422, f"Minimum condition must be one of {', '.join(GRADES)}")
    if target.pressing_id is not None:
        pressing = db.get(Pressing, target.pressing_id)
        if pressing is None or pressing.album_id != album_id:
            raise HTTPException(422, "That pressing isn't part of this album")


def own_item(db: Session, user: User, item_id: int) -> WishlistItem:
    item = db.get(WishlistItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(404, "Wishlist item not found")
    return item


def stock_for(db: Session, item: WishlistItem, origin: ZipCode, radius: int, now: datetime) -> dict:
    """Matching copies in the radius: count, nearest and cheapest; else the nearest outside."""
    terms = [Pressing.album_id == item.album_id, StockListing.quantity > 0, Store.active.is_(True),
             visible_inventory(now), visible(Pressing, now)]
    if item.pressing_id is not None:
        terms.append(StockListing.pressing_id == item.pressing_id)
    if item.max_price is not None:
        terms.append(StockListing.price <= item.max_price)
    listings = db.scalars(select(StockListing).join(StockListing.pressing).join(StockListing.store)
                          .where(*terms).options(joinedload(StockListing.store))).all()
    floor = GRADES.index(item.min_condition) if item.min_condition else None
    nearby, outside = [], []
    for listing in listings:
        rank = grade_rank(listing.condition)
        if floor is not None and (rank is None or rank < floor):
            continue
        d = haversine_mi(origin.lat, origin.lng, listing.store.lat, listing.store.lng)
        (nearby if within_radius(d, radius) else outside).append((listing, d))

    def shop(pair):
        listing, d = pair
        return {"store_name": listing.store.name, "distance_mi": display_miles(d),
                "price": float(listing.price)}

    return {
        "store_count": len({listing.store_id for listing, _ in nearby}),
        "nearest": shop(min(nearby, key=lambda p: (p[1], p[0].price))) if nearby else None,
        "cheapest": shop(min(nearby, key=lambda p: (p[0].price, p[1]))) if nearby else None,
        "nearest_outside_mi": display_miles(min(d for _, d in outside)) if outside and not nearby else None,
    }


def visible_now(pressing: Pressing, now: datetime) -> bool:
    """Discogs-cached pressings disappear six hours after their last fetch (as in search)."""
    return pressing.api_fetched_at is None or now - pressing.api_fetched_at < timedelta(hours=6)


def view(db: Session, item: WishlistItem, origin: ZipCode, radius: int, now: datetime) -> dict:
    album = item.album
    pressings = [p for p in album.pressings if visible_now(p, now)]
    chosen = next((p for p in pressings if p.id == item.pressing_id), None)
    return {
        "id": item.id,
        "album": {"id": album.id, "title": album.title, "year": album.year,
                  "artist": {"id": album.artist.id, "name": album.artist.name},
                  "cover_url": fresh_image(album.cover_url, getattr(album, "cover_fetched_at", None), now)},
        "pressing_id": item.pressing_id,
        "pressing_note": (chosen.variant_note or chosen.label) if chosen else None,
        "max_price": float(item.max_price) if item.max_price is not None else None,
        "min_condition": item.min_condition,
        "pressings": [{"id": p.id, "note": p.variant_note or p.label or p.format} for p in pressings],
        **stock_for(db, item, origin, radius, now),
    }


@router.get("")
def list_wishlist(user: Me, db: DB, now: Now,
                  zip: Annotated[str, Query(pattern=r"^\d{5}$")] = "10011", radius: int = 25):
    if radius not in ALLOWED_RADII_MI:
        raise HTTPException(422, f"radius must be one of {list(ALLOWED_RADII_MI)}")
    origin = db.get(ZipCode, zip)
    if origin is None:
        raise HTTPException(404, "Unknown ZIP code")
    items = db.scalars(select(WishlistItem).where(WishlistItem.user_id == user.id)
                       .options(joinedload(WishlistItem.album).joinedload(Album.artist),
                                joinedload(WishlistItem.album).selectinload(Album.pressings))
                       .order_by(WishlistItem.created_at.desc(), WishlistItem.id.desc())).unique().all()
    return {"zip": zip, "radius_mi": radius, "items": [view(db, i, origin, radius, now) for i in items]}


@router.get("/albums")
def wishlisted_albums(user: Me, db: DB):
    """Which albums have a filled heart."""
    ids = db.scalars(select(WishlistItem.album_id).where(WishlistItem.user_id == user.id).distinct())
    return {"album_ids": sorted(ids)}


@router.post("", status_code=201)
def add(body: NewItem, user: Me, db: DB, response: Response):
    if db.get(Album, body.album_id) is None:
        raise HTTPException(404, "Album not found")
    check_target(db, body.album_id, body)
    existing = db.scalar(select(WishlistItem).where(
        WishlistItem.user_id == user.id, WishlistItem.album_id == body.album_id,
        WishlistItem.pressing_id.is_(None) if body.pressing_id is None
        else WishlistItem.pressing_id == body.pressing_id))
    if existing is not None:  # tapping the heart again, or a double tap, adds nothing
        response.status_code = 200
        return {"id": existing.id, "album_id": existing.album_id}
    item = WishlistItem(user_id=user.id, album_id=body.album_id, pressing_id=body.pressing_id,
                        max_price=body.max_price, min_condition=body.min_condition, created_at=utcnow())
    db.add(item)
    db.commit()
    return {"id": item.id, "album_id": item.album_id}


@router.patch("/{item_id}")
def change(item_id: int, body: WishlistTarget, user: Me, db: DB):
    item = own_item(db, user, item_id)
    check_target(db, item.album_id, body)
    item.pressing_id, item.max_price, item.min_condition = (
        body.pressing_id, body.max_price, body.min_condition)
    db.commit()
    return {"id": item.id, "album_id": item.album_id}


@router.delete("/{item_id}", status_code=204)
def remove(item_id: int, user: Me, db: DB):
    db.delete(own_item(db, user, item_id))
    db.commit()
    return Response(status_code=204)


@router.delete("", status_code=204)
def remove_album(user: Me, db: DB, album_id: Annotated[int, Query()]):
    """The heart's "off": every wishlist entry for that album."""
    db.execute(delete(WishlistItem).where(WishlistItem.user_id == user.id,
                                          WishlistItem.album_id == album_id))
    db.commit()
    return Response(status_code=204)
