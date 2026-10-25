"""Catalog provenance, search index and durable worker queue."""
from alembic import op
import sqlalchemy as sa

revision = "c31001"
down_revision = "07f5f007e895"
branch_labels = None
depends_on = None


def upgrade():
    for table, columns in {
        "artists": [("origin", sa.String(120)), ("image_fetched_at", sa.DateTime()), ("api_fetched_at", sa.DateTime())],
        "albums": [("cover_fetched_at", sa.DateTime()), ("api_fetched_at", sa.DateTime())],
        "pressings": [("api_fetched_at", sa.DateTime()), ("exclusive_kind", sa.String(20))],
    }.items():
        for name, type_ in columns:
            op.add_column(table, sa.Column(name, type_, nullable=True))
    op.add_column("albums", sa.Column("release_type", sa.String(20), nullable=False, server_default="Studio"))
    op.create_index("ix_pressings_label", "pressings", ["label"])
    op.create_table("catalog_jobs", sa.Column("id", sa.Integer(), primary_key=True),
                    sa.Column("kind", sa.String(10), nullable=False),
                    sa.Column("discogs_id", sa.Integer(), nullable=False),
                    sa.Column("next_fetch", sa.DateTime(), nullable=False),
                    sa.UniqueConstraint("kind", "discogs_id"))
    op.create_index("ix_catalog_jobs_next_fetch", "catalog_jobs", ["next_fetch"])
    op.create_table("discogs_calls", sa.Column("id", sa.Integer(), primary_key=True),
                    sa.Column("reserved_at", sa.DateTime(), nullable=False))
    op.create_index("ix_discogs_calls_reserved_at", "discogs_calls", ["reserved_at"])


def downgrade():
    op.drop_table("discogs_calls")
    op.drop_table("catalog_jobs")
    op.drop_index("ix_pressings_label", table_name="pressings")
    op.drop_column("albums", "release_type")
    for table, columns in {"artists": ["origin", "image_fetched_at", "api_fetched_at"],
                           "albums": ["cover_fetched_at", "api_fetched_at"],
                           "pressings": ["api_fetched_at", "exclusive_kind"]}.items():
        for name in columns:
            op.drop_column(table, name)
