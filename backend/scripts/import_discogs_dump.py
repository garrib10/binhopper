"""Offline CC0 import. Never downloads files; bounded memory via iterparse/root.clear."""
import argparse
import gzip
from pathlib import Path
from xml.etree import ElementTree as ET

from sqlalchemy import delete, select

from app.db import SessionLocal
from app.models import Album, AlbumGenre, Artist, Pressing


def records(path: Path, tag: str):
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rb") as stream:
        context = ET.iterparse(stream, events=("start", "end"))
        _, root = next(context)
        for event, node in context:
            if event == "end" and node.tag == tag:
                yield node
                root.clear()


def upsert(s, model, key, value, **fields):
    row = s.scalar(select(model).where(getattr(model, key) == value))
    if row is None:
        row = model(**{key: value}, **fields)
        s.add(row)
    else:
        for name, item in fields.items():
            setattr(row, name, item)
    s.flush()
    return row


def artist(s, node):
    identifier = int(node.findtext("id") or node.get("id"))
    # A credit may not contain profile; do not erase an artist dump's richer profile.
    fields = {"name": node.findtext("name") or f"Artist {identifier}", "api_fetched_at": None}
    old = s.scalar(select(Artist).where(Artist.discogs_artist_id == identifier))
    if old is not None and old.api_fetched_at is not None:
        fields["bio"] = None
        fields["origin"] = None
    if node.find("profile") is not None:
        fields["bio"] = node.findtext("profile")
    return upsert(s, Artist, "discogs_artist_id", identifier, **fields)


def tracks(node):
    return [{"position": t.findtext("position") or "", "title": t.findtext("title") or ""}
            for t in node.findall("tracklist/track")]


def album(s, node, identifier):
    credit = node.find("artists/artist")
    if credit is None:
        return None
    a = artist(s, credit)
    row = upsert(s, Album, "discogs_master_id", identifier, artist_id=a.id,
                 title=node.findtext("title") or "Untitled", year=int(node.findtext("year") or 0) or None,
                 tracklist=tracks(node), api_fetched_at=None)
    s.execute(delete(AlbumGenre).where(AlbumGenre.album_id == row.id))
    s.add_all(AlbumGenre(album_id=row.id, genre=g.text[:60])
              for g in node.findall("genres/genre") if g.text)
    for style in node.findall("styles/style"):
        if style.text:
            s.add(AlbumGenre(album_id=row.id, genre=(node.findtext("genres/genre") or "Other")[:60],
                             style=style.text[:60]))
    s.flush()
    return row


def release(s, node):
    formats = node.findall("formats/format")
    if not any(f.get("name") == "Vinyl" for f in formats):
        return False
    master_id = int(node.findtext("master_id") or 0)
    # Releases without a master get a deterministic negative identity in the master column.
    identifier = master_id or -int(node.get("id"))
    a = s.scalar(select(Album).where(Album.discogs_master_id == identifier))
    if a is None:
        a = album(s, node, identifier)
    if a is None:
        return False
    if not a.tracklist:
        a.tracklist = tracks(node)
    if not a.year:
        released = node.findtext("released") or ""
        if released[:4].isdigit():
            a.year = int(released[:4]) or None
    descriptions = [d.text for f in formats for d in f.findall("descriptions/description") if d.text]
    for f in formats:
        if f.get("text"):
            descriptions.append(f.get("text"))
    details = ", ".join(descriptions)
    if "Compilation" in descriptions:
        a.release_type = "Compilations"
    elif "Live" in descriptions:
        a.release_type = "Live"
    exclusive = next((kind for text, kind in [("Artist Store Exclusive", "artist"),
                                              ("Retailer Exclusive", "retailer")]
                      if text.lower() in details.lower()), None)
    label = node.find("labels/label")
    barcode = next((b.get("value") for b in node.findall("identifiers/identifier")
                    if b.get("type") == "Barcode"), None)
    upsert(s, Pressing, "discogs_release_id", int(node.get("id")), album_id=a.id,
           label=label.get("name", "")[:255] if label is not None else None,
           catalog_no=label.get("catno", "")[:100] if label is not None else None,
           barcode=barcode[:32] if barcode else None, format="LP" if "LP" in descriptions else "Vinyl",
           variant_note=details[:255] or None, exclusive_kind=exclusive,
           exclusive_to=details[:120] if exclusive else None, api_fetched_at=None)
    return True


def import_path(s, path: Path, limit: int | None = None):
    counts = {}
    for kind, tag in [("artists", "artist"), ("masters", "master"), ("releases", "release")]:
        candidates = sorted(path.glob(f"*{kind}.xml*"))
        if len(candidates) != 1:
            raise ValueError(f"Expected exactly one {kind}.xml[.gz] file in {path}")
        count = 0
        for node in records(candidates[0], tag):
            if kind == "artists":
                artist(s, node)
            elif kind == "masters":
                album(s, node, int(node.get("id")))
            elif not release(s, node):
                continue
            count += 1
            if count % 100 == 0:
                s.commit()
                s.expunge_all()
            if limit and count >= limit:
                break
        s.commit()
        s.expunge_all()
        counts[kind] = count
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", type=Path)
    parser.add_argument("--sample", action="store_true")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    if bool(args.path) == args.sample or (args.limit is not None and args.limit < 1):
        parser.error("Choose --path DIR or --sample, with optional positive --limit")
    path = Path(__file__).resolve().parents[1] / "tests/fixtures/discogs_cc0" if args.sample else args.path
    with SessionLocal() as session:
        print(import_path(session, path, args.limit))


if __name__ == "__main__":
    main()
