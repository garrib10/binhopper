from datetime import datetime

from pydantic import BaseModel

from app.freshness import Freshness


class NearbyStore(BaseModel):
    listing_id: int
    store_id: int
    store_name: str
    area: str | None
    distance_mi: float
    pressing_id: int
    pressing_note: str | None
    price: float
    condition: str
    quantity: int
    freshness: Freshness
    last_updated_at: datetime | None
    missing_reports: int = 0  # "not on the shelf" reports in the last 24 h
    lat: float
    lng: float
    phone: str | None
    source: str = "manual"
    discogs_url: str | None = None


class OtherShop(BaseModel):
    """A shop in the radius with no online inventory: call to check (Nearby stock rule 9).

    Never carries a price, quantity or freshness: we don't know what's on its shelves.
    """

    store_id: int
    name: str
    area: str | None
    distance_mi: float
    phone: str | None
    lat: float
    lng: float


class NearbyStockResponse(BaseModel):
    album_id: int
    zip: str
    radius_mi: int
    center_lat: float
    center_lng: float
    stores: list[NearbyStore]
    # For the empty state: how far the closest copy outside the radius is.
    nearest_outside_mi: float | None
    other_shops: list[OtherShop] = []
