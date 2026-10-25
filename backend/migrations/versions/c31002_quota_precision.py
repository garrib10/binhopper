"""Keep fractional quota timestamps across MySQL worker restarts."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.mysql import DATETIME

revision = "c31002"
down_revision = "c31001"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("discogs_calls") as batch:
        batch.alter_column("reserved_at", existing_type=sa.DateTime(),
                           type_=sa.DateTime().with_variant(DATETIME(fsp=6), "mysql"),
                           existing_nullable=False)


def downgrade():
    with op.batch_alter_table("discogs_calls") as batch:
        batch.alter_column("reserved_at", existing_type=sa.DateTime().with_variant(DATETIME(fsp=6), "mysql"),
                           type_=sa.DateTime(), existing_nullable=False)
