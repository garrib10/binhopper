from datetime import datetime
from typing import Annotated
from urllib.parse import urlencode, urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.catalog_read import album_view, is_fresh
from app.db import get_session
from app.config import settings
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


@router.get("/albums/{album_id}/online")
def online_sellers(album_id: int, session: Annotated[Session, Depends(get_session)],
                   now: Annotated[datetime, Depends(get_now)]):
    album = session.get(Album, album_id)
    if album is None or not is_fresh(album, now):
        raise HTTPException(404, "Album not found")
    artist = album.artist
    name = artist.name if is_fresh(artist, now) else ""
    query = f"{name} {album.title} vinyl".strip()
    links = [
        {"name": "Discogs marketplace", "url": "https://www.discogs.com/sell/list?" + urlencode({"q": query, "format": "Vinyl"})},
        {"name": "eBay", "url": "https://www.ebay.com/sch/i.html?" + urlencode({"_nkw": query})},
        {"name": "Amazon", "url": "https://www.amazon.com/s?" + urlencode({"k": query})},
        {"name": "Urban Outfitters", "url": "https://www.urbanoutfitters.com/search?" + urlencode({"q": query})},
    ]
    official = settings.artist_store_urls.get(artist.id)
    parsed = urlsplit(str(official or ""))
    if official and parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password:
        links.insert(0, {"name": f"{name or 'Artist'} official store", "url": str(official)})
    return {"album_id": album_id, "album_title": album.title, "artist_name": name,
            "sellers": links}
