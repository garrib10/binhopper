"""Local catalog search/browse only: never calls Discogs from a request."""
from datetime import datetime, timedelta
from heapq import nsmallest
from itertools import islice
from typing import Annotated, Literal
from urllib.parse import urlencode, urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, func, or_, select, true
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db import get_session
from app.geo import bounding_box, haversine_mi, within_radius
from app.models import Album, AlbumGenre, Artist, Pressing, StockListing, Store, WishlistItem, ZipCode
from app.inventory import visible_inventory
from app.rate_limit import SEARCH, per_ip
from app.routers.stock import get_now

router = APIRouter(prefix="/api", tags=["catalog"])


def visible(model, now):
    column = getattr(model, "api_fetched_at", None)
    return true() if column is None else or_(column.is_(None), column > now - timedelta(hours=6))


def fresh_image(url, fetched, now):
    parsed = urlsplit(url or "")
    return url if (fetched and now - fetched < timedelta(hours=6) and parsed.scheme == "https"
                   and parsed.hostname and (parsed.hostname == "discogs.com" or parsed.hostname.endswith(".discogs.com"))) else None


def origin(session, zip, radius):
    if radius not in {10, 25, 50, 100}:
        raise HTTPException(422, "Invalid radius")
    row = session.get(ZipCode, zip)
    if row is None:
        raise HTTPException(404, "Unknown ZIP code")
    return row


def listing_terms(lp, new, used, under_30, now):
    terms = [StockListing.quantity > 0, Store.active.is_(True), visible(Pressing, now), visible_inventory(now)]
    if lp:
        terms.append(Pressing.format.ilike("%LP%"))
    if new != used:
        terms.append(StockListing.condition == "New" if new else StockListing.condition != "New")
    if under_30:
        terms.append(StockListing.price < 30)
    return terms


def summary(session, album, center, radius, terms, now):
    listings = session.scalars(select(StockListing).join(Pressing).join(Store).where(
        Pressing.album_id == album.id, *terms).options(joinedload(StockListing.store))).all()
    nearby, outside = [], []
    for listing in listings:
        distance = haversine_mi(center.lat, center.lng, listing.store.lat, listing.store.lng)
        if within_radius(distance, radius):
            nearby.append(listing)
        else:
            outside.append(distance)
    artist = album.artist
    pressings = [p for p in album.pressings if getattr(p, "api_fetched_at", None) is None
                 or now - p.api_fetched_at < timedelta(hours=6)]
    master_id = album.discogs_master_id
    return {"id": album.id, "title": album.title, "artist": {"id": artist.id, "name": artist.name},
            "year": album.year, "format": next((p.format for p in pressings), "Vinyl"),
            "cover_url": fresh_image(album.cover_url, getattr(album, "cover_fetched_at", None), now),
            "label": next((p.label for p in pressings if p.label), None),
            "store_count": len({s.store_id for s in nearby}),
            "lowest_price": min((float(s.price) for s in nearby), default=None),
            "nearest_outside_mi": round(min(outside), 1) if outside else None,
            "discogs_url": (f"https://www.discogs.com/master/{master_id}" if master_id and master_id > 0
                             else "https://www.discogs.com/search/?" + urlencode({"q": album.title}))}


def albums(session, now, center, radius, q=None, genre=None, decade=None, year=None,
           lp=False, new=False, used=False, under_30=False, in_stock_nearby=False,
           sort="popular", limit=50, offset=0):
    terms = listing_terms(lp, new, used, under_30, now)
    statement = select(Album).join(Artist).where(visible(Album, now), visible(Artist, now))
    if q:
        pattern = '%' + q.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        label_match = exists(select(Pressing.id).where(Pressing.album_id == Album.id,
                    visible(Pressing, now), Pressing.label.ilike(pattern, escape='\\')))
        statement = statement.where(or_(Album.title.ilike(pattern, escape='\\'),
                                         Artist.name.ilike(pattern, escape='\\'), label_match))
    if genre:
        statement = statement.where(exists(select(AlbumGenre.id).where(AlbumGenre.album_id == Album.id,
                   or_(func.lower(AlbumGenre.genre) == genre.lower(), func.lower(AlbumGenre.style) == genre.lower()))))
    if decade is not None:
        statement = statement.where(Album.year.between(decade, decade + 9))
    if year is not None:
        statement = statement.where(Album.year == year)
    if lp:
        statement = statement.where(exists(select(Pressing.id).where(Pressing.album_id == Album.id,
                                    visible(Pressing, now), Pressing.format.ilike('%LP%'))))
    if new or used or under_30 or in_stock_nearby or sort == 'near':
        stock = select(StockListing.id).join(Pressing).join(Store).where(Pressing.album_id == Album.id, *terms)
        if in_stock_nearby or sort == 'near':
            min_lat, max_lat, min_lng, max_lng = bounding_box(center.lat, center.lng, radius)
            stock = stock.where(Store.lat.between(min_lat, max_lat), Store.lng.between(min_lng, max_lng))
        statement = statement.where(exists(stock))
    # Aggregate popularity is only an ordering signal; no private wishlist rows/counts leave the API.
    popularity = select(func.count(WishlistItem.id)).where(WishlistItem.album_id == Album.id).scalar_subquery()
    statement = statement.order_by(popularity.desc(), Album.title, Album.id).options(
        joinedload(Album.artist), selectinload(Album.pressings))
    # Fetch bounded batches; exact radius filtering precedes pagination.
    def candidates():
        cursor = 0
        while True:
            batch = session.scalars(statement.limit(100).offset(cursor)).all()
            if not batch:
                return
            cursor += len(batch)
            for album in batch:
                item = summary(session, album, center, radius, terms, now)
                if (in_stock_nearby or sort == 'near') and not item['store_count']:
                    continue
                yield item
    if sort == 'near':
        # Bounded heap ranks all matching nearby candidates, not just the first page.
        return nsmallest(offset + limit, candidates(),
                         key=lambda a: (-a['store_count'], a['title'], a['id']))[offset:]
    return list(islice(candidates(), offset, offset + limit))



@router.get('/search', dependencies=[per_ip(SEARCH)])
def search(session: Annotated[Session, Depends(get_session)], now: Annotated[datetime, Depends(get_now)],
           q: Annotated[str, Query(max_length=200)] = '', type: Literal['albums', 'artists'] = 'albums',
           zip: Annotated[str, Query(pattern=r'^\d{5}$')] = '10011', radius: int = 25,
           lp: bool = False, new: bool = False, used: bool = False, under_30: bool = False,
           in_stock_nearby: bool = False, limit: Annotated[int, Query(ge=1, le=100)] = 50,
           offset: Annotated[int, Query(ge=0, le=10000)] = 0):
    if len(q.strip()) < 2:
        return {'albums': [], 'artists': []}
    center = origin(session, zip, radius)
    if type == 'artists':
        pattern = '%' + q.strip().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        rows = session.scalars(select(Artist).where(visible(Artist, now), Artist.name.ilike(pattern, escape='\\'))
                               .order_by(Artist.name, Artist.id).limit(limit).offset(offset)).all()
        return {'albums': [], 'artists': [{'id': a.id, 'name': a.name,
            'image_url': fresh_image(a.image_url, getattr(a, 'image_fetched_at', None), now)} for a in rows]}
    return {'artists': [], 'albums': albums(session, now, center, radius, q=q.strip(), lp=lp, new=new,
             used=used, under_30=under_30, in_stock_nearby=in_stock_nearby, limit=limit, offset=offset)}


@router.get('/browse', dependencies=[per_ip(SEARCH)])
def browse(session: Annotated[Session, Depends(get_session)], now: Annotated[datetime, Depends(get_now)],
           genre: Annotated[str, Query(min_length=1, max_length=60)],
           decade: Annotated[int | None, Query(ge=1900, le=2100)] = None,
           year: Annotated[int | None, Query(ge=1900, le=2109)] = None,
           sort: Literal['popular', 'near'] = 'popular',
           zip: Annotated[str, Query(pattern=r'^\d{5}$')] = '10011', radius: int = 25,
           lp: bool = False, new: bool = False, used: bool = False, under_30: bool = False,
           in_stock_nearby: bool = False, limit: Annotated[int, Query(ge=1, le=100)] = 50,
           offset: Annotated[int, Query(ge=0, le=10000)] = 0):
    if decade is not None and (decade % 10 or (year is not None and not decade <= year < decade + 10)):
        raise HTTPException(422, 'Choose a decade boundary and a year inside that decade')
    center = origin(session, zip, radius)
    return {'artists': [], 'albums': albums(session, now, center, radius, genre=genre,
             decade=decade, year=year, sort=sort, lp=lp, new=new, used=used, under_30=under_30,
             in_stock_nearby=in_stock_nearby, limit=limit, offset=offset)}
