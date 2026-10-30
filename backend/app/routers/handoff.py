"""Locate, hold, buy: hand off to the shop, then "Got it?" (SPEC.md › Locate, hold, buy; #40).

v1 has no in-app holds or orders: the app hands off to the shop's phone, website, maps
or Discogs listing. Coming back, the user can confirm they got it, which adds the copy
to their collection and takes the album off their wishlist (AC-10).
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_session
from app.freshness import classify
from app.grades import GRADES
from app.models import CollectionItem, StockListing, User
from app.routers.collection import DUPLICATE, copies_of, leave_wishlist, view
from app.routers.reports import visible_listing
from app.routers.search import fresh_image
from app.routers.stock import _missing_reports_last_24h, get_now
from app.sessions import current_user

router = APIRouter(prefix="/api", tags=["hand-off"])

DB = Annotated[Session, Depends(get_session)]
Now = Annotated[datetime, Depends(get_now)]


class GotIt(BaseModel):
    listing_id: int
    another_copy: bool = False


@router.get("/listings/{listing_id}")
def listing(listing_id: int, db: DB, now: Now):
    """One copy at one shop, with everything needed to hand off to the shop."""
    item = visible_listing(db, listing_id, now)
    store, pressing, album = item.store, item.pressing, item.pressing.album
    missing = _missing_reports_last_24h(db, [item.id], now).get(item.id, 0)
    return {
        "listing_id": item.id,
        "album": {"id": album.id, "title": album.title, "year": album.year, "artist": album.artist.name,
                  "cover_url": fresh_image(album.cover_url, getattr(album, "cover_fetched_at", None), now)},
        "pressing": {"id": pressing.id, "note": pressing.variant_note, "label": pressing.label,
                     "format": pressing.format},
        "store": {"id": store.id, "name": store.name, "area": store.area, "address": store.address,
                  "phone": store.phone, "website": store.website, "lat": store.lat, "lng": store.lng},
        "price": float(item.price), "condition": item.condition, "quantity": item.quantity,
        "freshness": classify(now, item.last_synced_at, item.last_verified_at, missing),
        "discogs_url": (f"https://www.discogs.com/sell/item/{item.discogs_listing_id}"
                        if item.source == "discogs" and item.discogs_listing_id else None),
    }


@router.post("/me/collection/from-listing", status_code=201)
def got_it(body: GotIt, user: Annotated[User, Depends(current_user)], db: DB, now: Now):
    """AC-10: "Got it? Add to collection" adds the copy and takes it off the wishlist (rule 6)."""
    item = db.get(StockListing, body.listing_id)  # may have sold out since the hand-off
    if item is None:
        raise HTTPException(404, "Listing not found")
    owned = copies_of(db, user, item.pressing_id)
    if owned and not body.another_copy:
        raise HTTPException(409, {"message": DUPLICATE, "copies": len(owned)})
    grade = "M" if item.condition.strip().upper() == "NEW" else item.condition.strip().upper()
    copy = CollectionItem(user_id=user.id, pressing_id=item.pressing_id, added_at=now,
                          price_paid=item.price, bought_at=item.store.name,
                          media_grade=grade if grade in GRADES else None)
    db.add(copy)
    wishlist = leave_wishlist(db, user.id, item.pressing)  # rule 6: a different specific pressing stays
    db.commit()
    return {**view(copy, len(owned) + 1, now), **wishlist}
