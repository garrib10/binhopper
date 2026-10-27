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
    lat: float
    lng: float
    phone: str | None
    source: str = "manual"
    discogs_url: str | None = None


class NearbyStockResponse(BaseModel):
    album_id: int
    zip: str
    radius_mi: int
    center_lat: float
    center_lng: float
    stores: list[NearbyStore]
    # For the empty state: how far the closest copy outside the radius is.
    nearest_outside_mi: float | None
