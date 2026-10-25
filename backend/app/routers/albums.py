from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.catalog_read import album_view, is_fresh
from app.db import get_session
from app.models import Album
from app.routers.stock import get_now

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/albums/{album_id}")
def album_detail(album_id: int, session: Annotated[Session, Depends(get_session)],
                 now: Annotated[datetime, Depends(get_now)],
                 zip: Annotated[str, Query(pattern=r"^\d{5}$")] = "10011", radius: int = 25):
    album = session.get(Album, album_id)
    if album is None or not is_fresh(album, now):
        raise HTTPException(404, "Album not found")
    return album_view(session, album, zip, radius, now)
