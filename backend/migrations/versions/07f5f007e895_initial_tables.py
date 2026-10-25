"""Initial tables: the 11 SPEC.md tables plus zip_codes.

Generated against MySQL 8.4 and reviewed by hand against app/models.py.

Revision ID: 07f5f007e895
Revises:
Create Date: 2026-10-24 19:59:57.533904
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '07f5f007e895'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('artists',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('discogs_artist_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('bio', sa.Text(), nullable=True),
    sa.Column('image_url', sa.String(length=500), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('discogs_artist_id')
    )
    op.create_index(op.f('ix_artists_name'), 'artists', ['name'], unique=False)
    op.create_table('stores',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('area', sa.String(length=120), nullable=True),
    sa.Column('address', sa.String(length=255), nullable=True),
    sa.Column('lat', sa.Float(), nullable=False),
    sa.Column('lng', sa.Float(), nullable=False),
    sa.Column('phone', sa.String(length=40), nullable=True),
    sa.Column('website', sa.String(length=500), nullable=True),
    sa.Column('hours', sa.JSON(), nullable=True),
    sa.Column('discogs_seller_name', sa.String(length=120), nullable=True),
    sa.Column('source', sa.String(length=30), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('discogs_seller_name')
    )
    op.create_index('ix_stores_lat_lng', 'stores', ['lat', 'lng'], unique=False)
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('username', sa.String(length=40), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('auth_provider', sa.String(length=20), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=True),
    sa.Column('home_zip', sa.String(length=5), nullable=True),
    sa.Column('default_radius_mi', sa.Integer(), nullable=False),
    sa.Column('theme', sa.String(length=10), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email'),
    sa.UniqueConstraint('username')
    )
    op.create_table('zip_codes',
    sa.Column('zip', sa.String(length=5), nullable=False),
    sa.Column('lat', sa.Float(), nullable=False),
    sa.Column('lng', sa.Float(), nullable=False),
    sa.PrimaryKeyConstraint('zip')
    )
    op.create_table('albums',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('discogs_master_id', sa.Integer(), nullable=True),
    sa.Column('artist_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('year', sa.Integer(), nullable=True),
    sa.Column('cover_url', sa.String(length=500), nullable=True),
    sa.Column('tracklist', sa.JSON(), nullable=False),
    sa.Column('cached_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('discogs_master_id')
    )
    op.create_index(op.f('ix_albums_title'), 'albums', ['title'], unique=False)
    op.create_index(op.f('ix_albums_year'), 'albums', ['year'], unique=False)
    op.create_table('user_settings',
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('use_current_location', sa.Boolean(), nullable=False),
    sa.Column('privacy_profile', sa.String(length=10), nullable=False),
    sa.Column('privacy_collection', sa.String(length=10), nullable=False),
    sa.Column('privacy_wishlist', sa.String(length=10), nullable=False),
    sa.Column('favorite_genres', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_table('album_genres',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('album_id', sa.Integer(), nullable=False),
    sa.Column('genre', sa.String(length=60), nullable=False),
    sa.Column('style', sa.String(length=60), nullable=True),
    sa.ForeignKeyConstraint(['album_id'], ['albums.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_album_genres_album_id'), 'album_genres', ['album_id'], unique=False)
    op.create_index('ix_album_genres_genre_style', 'album_genres', ['genre', 'style'], unique=False)
    op.create_table('pressings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('discogs_release_id', sa.Integer(), nullable=True),
    sa.Column('album_id', sa.Integer(), nullable=False),
    sa.Column('label', sa.String(length=255), nullable=True),
    sa.Column('catalog_no', sa.String(length=100), nullable=True),
    sa.Column('barcode', sa.String(length=32), nullable=True),
    sa.Column('format', sa.String(length=60), nullable=False),
    sa.Column('variant_note', sa.String(length=255), nullable=True),
    sa.Column('exclusive_to', sa.String(length=120), nullable=True),
    sa.ForeignKeyConstraint(['album_id'], ['albums.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('discogs_release_id')
    )
    op.create_index(op.f('ix_pressings_album_id'), 'pressings', ['album_id'], unique=False)
    op.create_index(op.f('ix_pressings_barcode'), 'pressings', ['barcode'], unique=False)
    op.create_table('collection_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('pressing_id', sa.Integer(), nullable=False),
    sa.Column('media_grade', sa.String(length=4), nullable=True),
    sa.Column('sleeve_grade', sa.String(length=4), nullable=True),
    sa.Column('price_paid', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('bought_at', sa.String(length=255), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('added_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['pressing_id'], ['pressings.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_collection_items_user_id'), 'collection_items', ['user_id'], unique=False)
    op.create_table('stock_listings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('store_id', sa.Integer(), nullable=False),
    sa.Column('pressing_id', sa.Integer(), nullable=False),
    sa.Column('price', sa.Numeric(precision=8, scale=2), nullable=False),
    sa.Column('condition', sa.String(length=20), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('source', sa.String(length=30), nullable=False),
    sa.Column('last_synced_at', sa.DateTime(), nullable=True),
    sa.Column('last_verified_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['pressing_id'], ['pressings.id'], ),
    sa.ForeignKeyConstraint(['store_id'], ['stores.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stock_listings_pressing_id'), 'stock_listings', ['pressing_id'], unique=False)
    op.create_index(op.f('ix_stock_listings_store_id'), 'stock_listings', ['store_id'], unique=False)
    op.create_table('wishlist_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('album_id', sa.Integer(), nullable=False),
    sa.Column('pressing_id', sa.Integer(), nullable=True),
    sa.Column('max_price', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('min_condition', sa.String(length=20), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['album_id'], ['albums.id'], ),
    sa.ForeignKeyConstraint(['pressing_id'], ['pressings.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'album_id', 'pressing_id')
    )
    op.create_index(op.f('ix_wishlist_items_user_id'), 'wishlist_items', ['user_id'], unique=False)
    op.create_table('stock_reports',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('listing_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('result', sa.String(length=20), nullable=False),
    sa.Column('reported_price', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['listing_id'], ['stock_listings.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stock_reports_created_at'), 'stock_reports', ['created_at'], unique=False)
    op.create_index(op.f('ix_stock_reports_listing_id'), 'stock_reports', ['listing_id'], unique=False)


def downgrade() -> None:
    # Drop tables only: each drop removes its own indexes, and MySQL refuses to drop an
    # index a foreign key still needs (error 1553), so explicit drop_index calls fail.
    op.drop_table('stock_reports')
    op.drop_table('wishlist_items')
    op.drop_table('stock_listings')
    op.drop_table('collection_items')
    op.drop_table('pressings')
    op.drop_table('album_genres')
    op.drop_table('user_settings')
    op.drop_table('albums')
    op.drop_table('zip_codes')
    op.drop_table('users')
    op.drop_table('stores')
    op.drop_table('artists')
