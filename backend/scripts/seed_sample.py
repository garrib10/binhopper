"""Load sample data for local development.

Everything here is FICTIONAL sample data matching the mockups (made-up shop
names, approximate NYC-area coordinates). Replace it with real shops from the
launch metro before any real use.

Run from backend/:  python -m scripts.seed_sample
"""

from datetime import timedelta

from app.db import SessionLocal
from app.models import Album, AlbumGenre, Artist, Pressing, StockListing, Store, ZipCode, utcnow

ZIPS = [("10011", 40.7418, -74.0040)]

STORES = [
    # name, area, lat, lng
    ("Spin Cycle Records", "Chelsea", 40.7465, -74.0014),
    ("Second Pressing", "Williamsburg", 40.7081, -73.9571),
    ("Groove Merchant", "Montclair, NJ", 40.8259, -74.2090),
    ("Dead Wax Exchange", "White Plains", 41.0340, -73.7629),
]


def main() -> None:
    now = utcnow()
    with SessionLocal() as s:
        if s.get(ZipCode, "10011"):
            print("Sample data already loaded.")
            return
        s.add_all(ZipCode(zip=z, lat=lat, lng=lng) for z, lat, lng in ZIPS)

        artist = Artist(name="Fleetwood Mac", bio="British-American rock band formed in London in 1967.")
        s.add(artist)
        s.flush()
        album = Album(
            artist_id=artist.id,
            title="Rumours",
            year=1977,
            tracklist=[
                {"position": p, "title": t}
                for p, t in [
                    ("A1", "Second Hand News"), ("A2", "Dreams"), ("A3", "Never Going Back Again"),
                    ("A4", "Don't Stop"), ("A5", "Go Your Own Way"), ("A6", "Songbird"),
                    ("B1", "The Chain"), ("B2", "You Make Loving Fun"), ("B3", "I Don't Want to Know"),
                    ("B4", "Oh Daddy"), ("B5", "Gold Dust Woman"),
                ]
            ],
        )
        s.add(album)
        s.flush()
        s.add_all(
            [
                AlbumGenre(album_id=album.id, genre="Rock", style="Pop Rock"),
                AlbumGenre(album_id=album.id, genre="Rock", style="Soft Rock"),
            ]
        )
        original = Pressing(album_id=album.id, label="Warner Bros.", variant_note="Original press")
        reissue = Pressing(album_id=album.id, label="Warner Bros.", variant_note="180g reissue")
        s.add_all([original, reissue])
        s.flush()

        stores = [Store(name=n, area=a, lat=lat, lng=lng) for n, a, lat, lng in STORES]
        s.add_all(stores)
        s.flush()
        s.add_all(
            [
                StockListing(store_id=stores[0].id, pressing_id=reissue.id, price=26, condition="New",
                             quantity=2, last_synced_at=now - timedelta(hours=3)),
                StockListing(store_id=stores[1].id, pressing_id=original.id, price=18, condition="VG+",
                             quantity=1, last_synced_at=now - timedelta(hours=20),
                             last_verified_at=now - timedelta(hours=2)),
                StockListing(store_id=stores[2].id, pressing_id=reissue.id, price=28, condition="New",
                             quantity=3, last_synced_at=now - timedelta(days=9)),
                StockListing(store_id=stores[3].id, pressing_id=original.id, price=22, condition="NM",
                             quantity=1, last_synced_at=now - timedelta(days=1)),
            ]
        )
        s.commit()
        print(f"Loaded sample data. Try: GET /api/albums/{album.id}/stock?zip=10011&radius=25")


if __name__ == "__main__":
    main()
