"""Nearby stock: which shops near a ZIP have an album (SPEC.md › Nearby stock)."""

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.db import get_session
from app.freshness import SORT_TIER, classify
from app.inventory import visible_inventory
from app.geo import ALLOWED_RADII_MI, bounding_box, display_miles, haversine_mi, within_radius
from app.models import Album, Pressing, StockListing, StockReport, Store, ZipCode, utcnow
from app.schemas import NearbyStockResponse, NearbyStore

router = APIRouter(prefix="/api", tags=["stock"])


def get_now() -> datetime:
    """Current UTC time; overridden in tests to freeze the clock."""
    return utcnow()


@router.get("/albums/{album_id}/stock", response_model=NearbyStockResponse)
def nearby_stock(
    album_id: int,
    zip: Annotated[str, Query(pattern=r"^\d{5}$", description="5-digit US ZIP code")],
    session: Annotated[Session, Depends(get_session)],
    now: Annotated[datetime, Depends(get_now)],
    radius: Annotated[int, Query(description="Search radius in miles: 10, 25, 50 or 100")] = 25,
) -> NearbyStockResponse:
    if radius not in ALLOWED_RADII_MI:
        raise HTTPException(422, f"radius must be one of {list(ALLOWED_RADII_MI)}")
    album = session.get(Album, album_id)
    if album is None or (album.api_fetched_at is not None and now - album.api_fetched_at >= timedelta(hours=6)):
        raise HTTPException(404, "Album not found")
    origin = session.get(ZipCode, zip)
    if origin is None:
        raise HTTPException(404, "Unknown ZIP code")

    base = (
        select(StockListing)
        .join(StockListing.store)
        .join(StockListing.pressing)
        .where(Pressing.album_id == album_id, StockListing.quantity > 0, visible_inventory(now),
               or_(Pressing.api_fetched_at.is_(None), Pressing.api_fetched_at > now - timedelta(hours=6)))
        .options(joinedload(StockListing.store), joinedload(StockListing.pressing))
    )

    # Cheap first pass in SQL (uses the lat/lng index), exact check in Python.
    min_lat, max_lat, min_lng, max_lng = bounding_box(origin.lat, origin.lng, radius)
    candidates = session.scalars(
        base.where(Store.lat.between(min_lat, max_lat), Store.lng.between(min_lng, max_lng))
    ).all()

    in_range = []
    for listing in candidates:
        d = haversine_mi(origin.lat, origin.lng, listing.store.lat, listing.store.lng)
        if within_radius(d, radius):
            in_range.append((listing, d))

    missing_counts = _missing_reports_last_24h(session, [listing.id for listing, _ in in_range], now)

    stores = []
    for listing, d in in_range:
        fresh = classify(
            now, listing.last_synced_at, listing.last_verified_at, missing_counts.get(listing.id, 0)
        )
        stores.append(
            NearbyStore(
                listing_id=listing.id,
                store_id=listing.store.id,
                store_name=listing.store.name,
                area=listing.store.area,
                distance_mi=display_miles(d),
                pressing_id=listing.pressing.id,
                pressing_note=listing.pressing.variant_note,
                price=float(listing.price),
                condition=listing.condition,
                quantity=listing.quantity,
                source=listing.source,
                discogs_url=(f"https://www.discogs.com/sell/item/{listing.discogs_listing_id}"
                             if listing.source == "discogs" and listing.discogs_listing_id else None),
                freshness=fresh,
                last_updated_at=max(
                    (t for t in (listing.last_synced_at, listing.last_verified_at) if t),
                    default=None,
                ),
            )
        )
    stores.sort(key=lambda s: (SORT_TIER[s.freshness], s.distance_mi))

    nearest_outside = None
    if not stores:
        others = session.scalars(base).all()
        distances = [
            haversine_mi(origin.lat, origin.lng, o.store.lat, o.store.lng) for o in others
        ]
        outside = [d for d in distances if not within_radius(d, radius)]
        nearest_outside = display_miles(min(outside)) if outside else None

    return NearbyStockResponse(
        album_id=album_id,
        zip=zip,
        radius_mi=radius,
        stores=stores,
        nearest_outside_mi=nearest_outside,
    )


def _missing_reports_last_24h(session: Session, listing_ids: list[int], now: datetime) -> dict[int, int]:
    if not listing_ids:
        return {}
    rows = session.execute(
        select(StockReport.listing_id, func.count())
        .where(
            StockReport.listing_id.in_(listing_ids),
            StockReport.result == "missing",
            StockReport.created_at >= now - timedelta(hours=24),
        )
        .group_by(StockReport.listing_id)
    ).all()
    return {listing_id: count for listing_id, count in rows}
