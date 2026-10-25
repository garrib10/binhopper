from datetime import datetime
from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.catalog_read import album_view, is_fresh, safe_image
from app.db import get_session
from app.models import Album, Artist
from app.routers.stock import get_now

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/artists/{artist_id}")
def artist_detail(artist_id: int, session: Annotated[Session, Depends(get_session)],
                  now: Annotated[datetime, Depends(get_now)],
                  zip: Annotated[str, Query(pattern=r"^\d{5}$")] = "10011", radius: int = 25):
    if radius not in {10, 25, 50, 100}:
        raise HTTPException(422, "Invalid radius")
    artist = session.get(Artist, artist_id)
    if artist is None or not is_fresh(artist, now):
        raise HTTPException(404, "Artist not found")
    albums = session.scalars(select(Album).where(Album.artist_id == artist.id)
                             .order_by(Album.year.is_(None), Album.year, Album.title, Album.id)
                             .options(selectinload(Album.pressings))).all()
    groups = {"Studio": [], "Live": [], "Compilations": []}
    genres = set()
    for album in albums:
        if not is_fresh(album, now):
            continue
        data = album_view(session, album, zip, radius, now)
        genres.update(data["genres"])
        kind = data["release_type"]
        if kind not in groups:
            kind = "Studio"
        groups[kind].append({k: v for k, v in data.items() if k not in {"tracklist", "pressings"}})
    return {"id": artist.id, "name": artist.name, "bio": artist.bio,
            "origin": getattr(artist, "origin", None), "genres": sorted(genres),
            "image_url": safe_image(artist.image_url, getattr(artist, "image_fetched_at", None), now),
            "discography": groups,
            "discogs_url": (f"https://www.discogs.com/artist/{artist.discogs_artist_id}"
                            if artist.discogs_artist_id else "https://www.discogs.com/search/?" +
                            urlencode({"q": artist.name, "type": "artist"}))}
