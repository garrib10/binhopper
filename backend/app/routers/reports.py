"""Stock reports: "I saw it here" (SPEC.md › Data sources, Nearby stock rules 5, 6 and 9; #37).

Signed in only. One report per user per listing per day (AC-07), and per user, store and
album for "I saw it here" at a shop with no online inventory (AC-18).
"""

from datetime import datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.freshness import classify
from app.inventory import visible_inventory
from app.models import Album, Pressing, StockListing, StockReport, Store, User
from app.rate_limit import Limit
from app.routers.search import visible
from app.routers.stock import _missing_reports_last_24h, get_now
from app.sessions import current_user

router = APIRouter(prefix="/api", tags=["reports"])

DB = Annotated[Session, Depends(get_session)]
Me = Annotated[User, Depends(current_user)]
Now = Annotated[datetime, Depends(get_now)]

ALREADY = "You already reported this today"
# SPEC › Abuse limits: reports are limited per user, on top of one per listing per day.
REPORTS_PER_USER = Limit("reports-user", 30, timedelta(hours=1))


class ListingReport(BaseModel):
    result: Literal["present", "missing", "different_price"]
    reported_price: float | None = Field(default=None, gt=0, le=100_000)

    @model_validator(mode="after")
    def price_with_a_different_price(self):
        if self.result == "different_price" and self.reported_price is None:
            raise ValueError("Enter the price on the sticker")
        return self


class ShopSighting(BaseModel):
    """'It's on the shelf' at a shop with no listing for the album yet (rule 9)."""

    album_id: int
    pressing_id: int
    condition: Literal["New", "Used"]
    price: float = Field(gt=0, le=100_000)


def visible_listing(db: Session, listing_id: int, now: datetime) -> StockListing:
    listing = db.scalar(select(StockListing).join(StockListing.store).join(StockListing.pressing).where(
        StockListing.id == listing_id, StockListing.quantity > 0, Store.active.is_(True),
        visible_inventory(now), visible(Pressing, now)))
    if listing is None:
        raise HTTPException(404, "Listing not found")
    return listing


def limit_reports(db: Session, user: User, now: datetime) -> None:
    if REPORTS_PER_USER.hit(db, str(user.id), now):
        raise REPORTS_PER_USER.too_many(now)


def reported_today(db: Session, user: User, listing_id: int, now: datetime) -> bool:
    return db.scalar(select(StockReport.id).where(
        StockReport.listing_id == listing_id, StockReport.user_id == user.id,
        StockReport.created_at > now - timedelta(hours=24))) is not None


@router.get("/stock/{listing_id}")
def listing_for_report(listing_id: int, user: Me, db: DB, now: Now):
    """What the report screen shows: the listing as the app lists it."""
    listing = visible_listing(db, listing_id, now)
    missing = _missing_reports_last_24h(db, [listing.id], now).get(listing.id, 0)
    album = listing.pressing.album
    return {
        "listing_id": listing.id, "store": {"id": listing.store.id, "name": listing.store.name},
        "album": {"id": album.id, "title": album.title},
        "pressing_note": listing.pressing.variant_note or listing.pressing.label or listing.pressing.format,
        "price": float(listing.price), "condition": listing.condition, "quantity": listing.quantity,
        "source": listing.source,
        "freshness": classify(now, listing.last_synced_at, listing.last_verified_at, missing),
        "last_updated_at": max((t for t in (listing.last_synced_at, listing.last_verified_at) if t),
                               default=None),
        "reported_today": reported_today(db, user, listing.id, now),
    }


@router.post("/stock/{listing_id}/reports", status_code=201)
def report_listing(listing_id: int, body: ListingReport, user: Me, db: DB, now: Now):
    listing = visible_listing(db, listing_id, now)
    if reported_today(db, user, listing.id, now):
        raise HTTPException(429, ALREADY)  # AC-07
    limit_reports(db, user, now)
    db.add(StockReport(listing_id=listing.id, user_id=user.id, result=body.result,
                       reported_price=body.reported_price, created_at=now))
    if body.result == "present":
        listing.last_verified_at = now  # "Verified" for 24 h (rule 5)
    elif body.result == "different_price" and listing.source != "discogs":
        # A shop-floor price beats ours until the shop confirms. Discogs listings keep
        # Discogs' price: their data is refreshed from the source, never overwritten.
        listing.price, listing.last_verified_at = body.reported_price, now
    db.commit()
    return {"listing_id": listing.id, "result": body.result}


@router.get("/stores/{store_id}/sighting")
def sighting_form(store_id: int, user: Me, db: DB, now: Now, album_id: Annotated[int, Query()]):
    """What "I saw it here" asks about: the shop and the album's pressings."""
    store, album = shop_without_listing(db, store_id, album_id, now)
    pressings = [p for p in sorted(album.pressings, key=lambda p: p.id)
                 if p.api_fetched_at is None or now - p.api_fetched_at < timedelta(hours=6)]
    return {"store": {"id": store.id, "name": store.name, "area": store.area},
            "album": {"id": album.id, "title": album.title, "artist": album.artist.name},
            "pressings": [{"id": p.id, "note": p.variant_note or p.label or p.format,
                           "detail": " · ".join(x for x in (p.label, p.format) if x)} for p in pressings]}


@router.post("/stores/{store_id}/sightings", status_code=201)
def report_sighting(store_id: int, body: ShopSighting, user: Me, db: DB, now: Now):
    """AC-18: the shop moves into the stock list as a user-reported listing."""
    store, album = shop_without_listing(db, store_id, body.album_id, now)
    pressing = db.get(Pressing, body.pressing_id)
    if pressing is None or pressing.album_id != album.id:
        raise HTTPException(422, "That pressing isn't part of this album")
    if db.scalar(select(StockReport.id).join(StockReport.listing).join(StockListing.pressing).where(
            StockReport.user_id == user.id, StockListing.store_id == store.id,
            Pressing.album_id == album.id, StockReport.created_at > now - timedelta(hours=24))):
        raise HTTPException(429, ALREADY)
    limit_reports(db, user, now)
    # Reuse this shop's old report listing for the pressing (sold out or stale), if any.
    listing = db.scalar(select(StockListing).where(StockListing.store_id == store.id,
                                                   StockListing.pressing_id == pressing.id,
                                                   StockListing.source == "report"))
    if listing is None:
        listing = StockListing(store_id=store.id, pressing_id=pressing.id, source="report")
        db.add(listing)
    listing.price, listing.condition, listing.quantity = body.price, body.condition, 1
    listing.last_verified_at = now
    db.flush()
    db.add(StockReport(listing_id=listing.id, user_id=user.id, result="present", created_at=now))
    db.commit()
    return {"listing_id": listing.id, "store_id": store.id}


def shop_without_listing(db: Session, store_id: int, album_id: int, now: datetime) -> tuple[Store, Album]:
    """An active shop with no Discogs seller account and no visible listing for the album."""
    store, album = db.get(Store, store_id), db.get(Album, album_id)
    if store is None or not store.active or album is None:
        raise HTTPException(404, "Shop or album not found")
    if store.discogs_seller_name is not None:
        raise HTTPException(409, "This shop's stock comes from its Discogs inventory")
    listed = db.scalar(select(StockListing.id).join(StockListing.pressing).where(
        StockListing.store_id == store.id, Pressing.album_id == album.id, StockListing.quantity > 0,
        visible_inventory(now)))
    if listed is not None:
        raise HTTPException(409, "This shop already lists this album: report on that listing")
    return store, album
