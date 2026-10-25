"""API gap materialization and URL-only image cache. CC0 fields stay durable."""
from datetime import timedelta
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET

from sqlalchemy import delete, or_, select

from app.models import Album, AlbumGenre, Artist, CatalogJob, Pressing, utcnow
from scripts.import_discogs_dump import album, artist, release

TTL = timedelta(hours=6)


def fresh(row, now=None):
    fetched = getattr(row, "api_fetched_at", None)
    return fetched is None or (now or utcnow()) - fetched < TTL


def image_url(url):
    # Store only trusted remote HTTPS image locations; never download image bytes.
    parsed = urlsplit(url or "")
    if parsed.scheme == "https" and parsed.hostname and (
        parsed.hostname == "discogs.com" or parsed.hostname.endswith(".discogs.com")):
        return url[:500]
    return None


def apply_response(s, kind, payload, now):
    identifier = int(payload["id"])
    if kind == "artists":
        row = s.scalar(select(Artist).where(Artist.discogs_artist_id == identifier))
        if row is None or row.api_fetched_at is not None:
            node = ET.Element("artist")
            for key, value in {"id": identifier, "name": payload.get("name", "Unknown artist"),
                               "profile": payload.get("profile", "")}.items():
                ET.SubElement(node, key).text = str(value)
            row = artist(s, node, from_api=True)
            row.api_fetched_at = now
        images = payload.get("images") or []
        row.image_url = image_url(images[0].get("uri")) if images else None
        row.image_fetched_at = now
        return row
    model, field = (Album, Album.discogs_master_id) if kind == "masters" else (Pressing, Pressing.discogs_release_id)
    row = s.scalar(select(model).where(field == identifier))
    if row is None or row.api_fetched_at is not None:
        node = ET.Element("master" if kind == "masters" else "release", id=str(identifier))
        for key in ("title", "year", "master_id"):
            if payload.get(key) is not None:
                ET.SubElement(node, key).text = str(payload[key])
        credits = ET.SubElement(node, "artists")
        api_artists = []
        for credit in payload.get("artists", []):
            existing = s.scalar(select(Artist).where(Artist.discogs_artist_id == credit["id"]))
            if existing is None or existing.api_fetched_at is not None:
                api_artists.append(credit["id"])
            a = ET.SubElement(credits, "artist")
            ET.SubElement(a, "id").text = str(credit["id"])
            ET.SubElement(a, "name").text = credit.get("name", "Unknown artist")
        genres = ET.SubElement(node, "genres")
        for g in payload.get("genres", []):
            ET.SubElement(genres, "genre").text = g
        tracklist = ET.SubElement(node, "tracklist")
        for track in payload.get("tracklist", []):
            t = ET.SubElement(tracklist, "track")
            for key in ("title", "position"):
                ET.SubElement(t, key).text = track.get(key, "")
        if kind == "masters":
            row = album(s, node, identifier, from_api=True)
        else:
            formats = ET.SubElement(node, "formats")
            for fmt in payload.get("formats", []):
                f = ET.SubElement(formats, "format", name=fmt.get("name", ""))
                ds = ET.SubElement(f, "descriptions")
                for text in fmt.get("descriptions", []):
                    ET.SubElement(ds, "description").text = text
            labels = ET.SubElement(node, "labels")
            for label in payload.get("labels", []):
                ET.SubElement(labels, "label", name=label.get("name", ""), catno=label.get("catno", ""))
            master_before = s.scalar(select(Album).where(Album.discogs_master_id == int(payload.get("master_id") or -identifier)))
            if not release(s, node, from_api=True):
                return None
            row = s.scalar(select(Pressing).where(Pressing.discogs_release_id == identifier))
            if master_before is None:
                row.album.api_fetched_at = now
        if row is None:
            return None
        row.api_fetched_at = now
        for artist_id in api_artists:
            a = s.scalar(select(Artist).where(Artist.discogs_artist_id == artist_id))
            a.api_fetched_at = now
            a.bio, a.origin, a.image_url, a.image_fetched_at = None, None, None, None
            if s.scalar(select(CatalogJob.id).where(CatalogJob.kind == "artists", CatalogJob.discogs_id == artist_id)) is None:
                s.add(CatalogJob(kind="artists", discogs_id=artist_id))
    if kind == "masters":
        images = payload.get("images") or []
        row.cover_url = image_url(images[0].get("uri")) if images else None
        row.cover_fetched_at = now
    return row


def expire(s, now):
    # Durable CC0 fields survive; expired API-only fields are scrubbed in place so
    # user-owned pressing/collection foreign keys are never broken by cache expiry.
    for model in (Artist, Album, Pressing):
        fields = [model.api_fetched_at <= now - TTL]
        if model is Artist:
            fields.append(model.image_fetched_at <= now - TTL)
        elif model is Album:
            fields.append(model.cover_fetched_at <= now - TTL)
        last = 0
        while True:
            batch = s.scalars(select(model).where(or_(*fields), model.id > last)
                              .order_by(model.id).limit(100)).all()
            if not batch:
                break
            for row in batch:
                last = row.id
                if isinstance(row, Artist) and row.image_fetched_at and now - row.image_fetched_at >= TTL:
                    row.image_url, row.image_fetched_at = None, None
                if isinstance(row, Album) and row.cover_fetched_at and now - row.cover_fetched_at >= TTL:
                    row.cover_url, row.cover_fetched_at = None, None
                if not fresh(row, now):
                    if isinstance(row, Artist):
                        row.name, row.bio, row.origin, row.image_url = "Unavailable artist", None, None, None
                    elif isinstance(row, Album):
                        row.title, row.tracklist, row.year, row.cover_url = "Unavailable album", [], None, None
                        s.execute(delete(AlbumGenre).where(AlbumGenre.album_id == row.id))
                    else:
                        row.label, row.variant_note, row.exclusive_to, row.barcode = None, None, None, None
                        row.exclusive_kind, row.catalog_no, row.format = None, None, "Unavailable"
            s.commit()
