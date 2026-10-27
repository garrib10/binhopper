"""Track seller schedules and individual marketplace listings."""
from alembic import op
import sqlalchemy as sa

revision = "c49001"
down_revision = "c31002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("stores", sa.Column("inventory_next_sync", sa.DateTime(), nullable=True))
    op.create_index("ix_stores_inventory_next_sync", "stores", ["inventory_next_sync"])
    with op.batch_alter_table("stock_listings") as batch:
        batch.add_column(sa.Column("discogs_listing_id", sa.BigInteger(), nullable=True))
        batch.create_unique_constraint("uq_stock_discogs_listing_id", ["discogs_listing_id"])


def downgrade():
    with op.batch_alter_table("stock_listings") as batch:
        batch.drop_constraint("uq_stock_discogs_listing_id", type_="unique")
        batch.drop_column("discogs_listing_id")
    op.drop_index("ix_stores_inventory_next_sync", "stores")
    op.drop_column("stores", "inventory_next_sync")
