"""Database tables (SPEC.md › Data model).

Times are stored as naive UTC datetimes. Store locations are plain lat/lng
columns (DOUBLE: MySQL's FLOAT keeps only ~7 digits, enough to push a store
at exactly 25.0 mi outside a 25 mi radius) with a composite index: the nearby search filters by a bounding box
in SQL, then checks exact distance in Python (see app/geo.py).
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    BigInteger,
    DateTime,
    Double,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.mysql import DATETIME as MYSQL_DATETIME
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(40), unique=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    auth_provider: Mapped[str] = mapped_column(String(20), default="email")  # email | google
    # Argon2id; None for accounts that only sign in with Google.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime)
    # Email sign-ups confirm their address by link before the first sign-in.
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True)
    home_zip: Mapped[str | None] = mapped_column(String(5))
    default_radius_mi: Mapped[int] = mapped_column(Integer, default=25)
    theme: Mapped[str] = mapped_column(String(10), default="system")  # light | dark | system
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    settings: Mapped["UserSettings"] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    use_current_location: Mapped[bool] = mapped_column(Boolean, default=False)
    # Private by default (SPEC.md › Privacy): public | friends | private
    privacy_profile: Mapped[str] = mapped_column(String(10), default="private")
    privacy_collection: Mapped[str] = mapped_column(String(10), default="private")
    privacy_wishlist: Mapped[str] = mapped_column(String(10), default="private")
    favorite_genres: Mapped[list[str]] = mapped_column(JSON, default=list)

    user: Mapped[User] = relationship(back_populates="settings")


class UserSession(Base):
    """A signed-in browser. Only the SHA-256 of the cookie token is stored."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuthToken(Base):
    """Single-use emailed link: verify_email (24 h) or reset_password (1 h)."""

    __tablename__ = "auth_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(20))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime)


class OAuthState(Base):
    """A Google sign-in in progress (state, nonce and PKCE verifier), kept 10 minutes."""

    __tablename__ = "oauth_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    state_hash: Mapped[str] = mapped_column(String(64), unique=True)
    code_verifier: Mapped[str] = mapped_column(String(128))
    nonce: Mapped[str] = mapped_column(String(64))
    return_to: Mapped[str] = mapped_column(String(500))
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)


class RateLimitHit(Base):
    """Fixed-window request counters, in the database so they survive restarts and sleep."""

    __tablename__ = "rate_limit_hits"

    bucket: Mapped[str] = mapped_column(String(120), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime, primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)


class Artist(Base):
    __tablename__ = "artists"

    id: Mapped[int] = mapped_column(primary_key=True)
    discogs_artist_id: Mapped[int | None] = mapped_column(Integer, unique=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    bio: Mapped[str | None] = mapped_column(Text)
    origin: Mapped[str | None] = mapped_column(String(120))
    image_fetched_at: Mapped[datetime | None] = mapped_column(DateTime)
    api_fetched_at: Mapped[datetime | None] = mapped_column(DateTime)
    image_url: Mapped[str | None] = mapped_column(String(500))


class Album(Base):
    """A Discogs "master": the album, across all its pressings."""

    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(primary_key=True)
    discogs_master_id: Mapped[int | None] = mapped_column(Integer, unique=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"))
    title: Mapped[str] = mapped_column(String(255), index=True)
    year: Mapped[int | None] = mapped_column(Integer, index=True)
    cover_url: Mapped[str | None] = mapped_column(String(500))
    cover_fetched_at: Mapped[datetime | None] = mapped_column(DateTime)
    api_fetched_at: Mapped[datetime | None] = mapped_column(DateTime)
    release_type: Mapped[str] = mapped_column(String(20), default="Studio", server_default="Studio")
    # [{"position": "A1", "title": "Second Hand News"}, ...]
    tracklist: Mapped[list[dict]] = mapped_column(JSON, default=list)
    cached_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    artist: Mapped[Artist] = relationship()
    pressings: Mapped[list["Pressing"]] = relationship(back_populates="album")


class AlbumGenre(Base):
    __tablename__ = "album_genres"
    __table_args__ = (Index("ix_album_genres_genre_style", "genre", "style"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    album_id: Mapped[int] = mapped_column(ForeignKey("albums.id", ondelete="CASCADE"), index=True)
    genre: Mapped[str] = mapped_column(String(60))
    style: Mapped[str | None] = mapped_column(String(60))


class Pressing(Base):
    """A Discogs "release": one specific vinyl edition of an album."""

    __tablename__ = "pressings"

    id: Mapped[int] = mapped_column(primary_key=True)
    discogs_release_id: Mapped[int | None] = mapped_column(Integer, unique=True)
    album_id: Mapped[int] = mapped_column(ForeignKey("albums.id"), index=True)
    api_fetched_at: Mapped[datetime | None] = mapped_column(DateTime)
    exclusive_kind: Mapped[str | None] = mapped_column(String(20))
    label: Mapped[str | None] = mapped_column(String(255), index=True)
    catalog_no: Mapped[str | None] = mapped_column(String(100))
    barcode: Mapped[str | None] = mapped_column(String(32), index=True)
    format: Mapped[str] = mapped_column(String(60), default="LP")
    variant_note: Mapped[str | None] = mapped_column(String(255))  # "180g", "Clear vinyl"
    exclusive_to: Mapped[str | None] = mapped_column(String(120))  # "Urban Outfitters"

    album: Mapped[Album] = relationship(back_populates="pressings")


class Store(Base):
    __tablename__ = "stores"
    __table_args__ = (Index("ix_stores_lat_lng", "lat", "lng"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    area: Mapped[str | None] = mapped_column(String(120))  # neighborhood or town shown in lists
    address: Mapped[str | None] = mapped_column(String(255))
    lat: Mapped[float] = mapped_column(Double)
    lng: Mapped[float] = mapped_column(Double)
    phone: Mapped[str | None] = mapped_column(String(40))
    website: Mapped[str | None] = mapped_column(String(500))
    hours: Mapped[dict | None] = mapped_column(JSON)
    discogs_seller_name: Mapped[str | None] = mapped_column(String(120), unique=True)
    source: Mapped[str] = mapped_column(String(30), default="manual")  # manual | places
    inventory_next_sync: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    shop_key: Mapped[str] = mapped_column(String(255), unique=True, default=lambda: "unmapped-" + uuid4().hex)
    osm_id: Mapped[str | None] = mapped_column(String(40), unique=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime)


class StockListing(Base):
    __tablename__ = "stock_listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    pressing_id: Mapped[int] = mapped_column(ForeignKey("pressings.id"), index=True)
    price: Mapped[float] = mapped_column(Numeric(8, 2))
    condition: Mapped[str] = mapped_column(String(20))  # "New" or a grade like "VG+"
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    source: Mapped[str] = mapped_column(String(30), default="discogs")  # discogs | manual | report
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime)
    discogs_listing_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)

    store: Mapped[Store] = relationship()
    pressing: Mapped[Pressing] = relationship()


class StockReport(Base):
    __tablename__ = "stock_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("stock_listings.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    result: Mapped[str] = mapped_column(String(20))  # present | missing | different_price
    reported_price: Mapped[float | None] = mapped_column(Numeric(8, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class WishlistItem(Base):
    __tablename__ = "wishlist_items"
    __table_args__ = (UniqueConstraint("user_id", "album_id", "pressing_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    album_id: Mapped[int] = mapped_column(ForeignKey("albums.id"))
    pressing_id: Mapped[int | None] = mapped_column(ForeignKey("pressings.id"))  # None = any pressing
    max_price: Mapped[float | None] = mapped_column(Numeric(8, 2))
    min_condition: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CollectionItem(Base):
    """One copy a user owns. Owning the same pressing twice = two rows."""

    __tablename__ = "collection_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    pressing_id: Mapped[int] = mapped_column(ForeignKey("pressings.id"))
    media_grade: Mapped[str | None] = mapped_column(String(4))  # M, NM, VG+, VG, G+, G, P
    sleeve_grade: Mapped[str | None] = mapped_column(String(4))
    price_paid: Mapped[float | None] = mapped_column(Numeric(8, 2))
    bought_at: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ZipCode(Base):
    """ZIP code center points, loaded once at setup."""

    __tablename__ = "zip_codes"

    zip: Mapped[str] = mapped_column(String(5), primary_key=True)
    lat: Mapped[float] = mapped_column(Double)
    lng: Mapped[float] = mapped_column(Double)


class CatalogJob(Base):
    """Durable API-gap/image refresh queue, consumed only by the separate worker."""
    __tablename__ = "catalog_jobs"
    __table_args__ = (UniqueConstraint("kind", "discogs_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(10))
    discogs_id: Mapped[int] = mapped_column(Integer)
    next_fetch: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class DiscogsCall(Base):
    """Persist reservations so a worker restart cannot reset its rolling quota."""
    __tablename__ = "discogs_calls"
    id: Mapped[int] = mapped_column(primary_key=True)
    reserved_at: Mapped[datetime] = mapped_column(
        DateTime().with_variant(MYSQL_DATETIME(fsp=6), "mysql"), index=True)
