"""Turn a device location into the nearest ZIP (SPEC.md › Onboarding rule 2; #43).

The coordinates are used for this one lookup and never stored: the app keeps the
home ZIP, not GPS history (SPEC.md › Privacy › Location).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.geo import bounding_box, haversine_mi
from app.models import ZipCode
from app.rate_limit import SEARCH, per_ip

router = APIRouter(prefix="/api/zips", tags=["location"])


@router.get("/nearest", dependencies=[per_ip(SEARCH)])
def nearest_zip(session: Annotated[Session, Depends(get_session)],
                lat: Annotated[float, Query(ge=-90, le=90)], lng: Annotated[float, Query(ge=-180, le=180)]):
    for miles in (5, 25, 100):  # widen until a ZIP center is in range
        min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, miles)
        rows = session.scalars(select(ZipCode).where(ZipCode.lat.between(min_lat, max_lat),
                                                     ZipCode.lng.between(min_lng, max_lng))).all()
        if rows:
            best = min(rows, key=lambda z: haversine_mi(lat, lng, z.lat, z.lng))
            return {"zip": best.zip}
    raise HTTPException(404, "We couldn't find a ZIP near you. Enter it instead.")
