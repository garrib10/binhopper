"""Catalog reader contract, compatible with the separate CC0 migration PR."""
from datetime import timedelta
from urllib.parse import urlencode, urlsplit

from sqlalchemy import select

from app.models import AlbumGenre, utcnow
from app.routers.stock import nearby_stock


def is_fresh(row, now):
    fetched = getattr(row, "api_fetched_at", None)
    return fetched is None or now - fetched < timedelta(hours=6)


def safe_image(url, fetched, now):
    parsed = urlsplit(url or "")
    if (fetched is None or now - fetched >= timedelta(hours=6) or parsed.scheme != "https"
            or not parsed.hostname or not (parsed.hostname == "discogs.com" or parsed.hostname.endswith(".discogs.com"))):
        return None
    return url


def stock_summary(session, album_id, zip, radius, now):
    data = nearby_stock(album_id, zip, session, now, radius)
    stores = data.stores
    return {"store_count": len({s.store_id for s in stores}),
            "lowest_price": min((s.price for s in stores), default=None),
            "nearest_outside_mi": data.nearest_outside_mi}


def album_view(session, album, zip, radius, now=None):
    now = now or utcnow()
    a = album.artist
    artist_fresh = is_fresh(a, now)
    name = a.name if artist_fresh else "Unavailable artist"
    pressings = [p for p in album.pressings if is_fresh(p, now)]
    genres = session.scalars(select(AlbumGenre).where(AlbumGenre.album_id == album.id)).all()
    master_id = album.discogs_master_id
    source = (f"https://www.discogs.com/master/{master_id}" if master_id and master_id > 0 else
              next((f"https://www.discogs.com/release/{p.discogs_release_id}" for p in pressings if p.discogs_release_id),
                   "https://www.discogs.com/search/?" + urlencode({"q": f"{name} {album.title}", "type": "master"})))
    return {"id": album.id, "title": album.title, "artist": {"id": a.id, "name": name},
            "year": album.year, "cover_url": safe_image(album.cover_url, getattr(album, "cover_fetched_at", None), now),
            "genres": sorted({g.genre for g in genres} | {g.style for g in genres if g.style}),
            "label": next((p.label for p in pressings if p.label), None),
            "tracklist": album.tracklist, "release_type": getattr(album, "release_type", "Studio"),
            "pressings": [{"id": p.id, "label": p.label, "format": p.format,
                           "variant_note": p.variant_note, "exclusive_to": p.exclusive_to,
                           "exclusive_kind": getattr(p, "exclusive_kind", None)} for p in pressings],
            "discogs_url": source, **stock_summary(session, album.id, zip, radius, now)}
