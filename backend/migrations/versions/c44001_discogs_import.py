"""Discogs import (#44): connected accounts (encrypted tokens), import jobs, pending releases."""
from alembic import op
import sqlalchemy as sa

revision = "c44001"
down_revision = "c38001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "discogs_accounts",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("username", sa.String(120), nullable=False),
        sa.Column("token_enc", sa.Text(), nullable=False),
        sa.Column("secret_enc", sa.Text(), nullable=False),
        sa.Column("connected_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "import_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("collection_page", sa.Integer(), nullable=True),
        sa.Column("wantlist_page", sa.Integer(), nullable=True),
        sa.Column("added", sa.Integer(), nullable=False),
        sa.Column("wishlisted", sa.Integer(), nullable=False),
        sa.Column("skipped", sa.Integer(), nullable=False),
        sa.Column("unmatched", sa.Integer(), nullable=False),
        sa.Column("error", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_import_jobs_user_id", "import_jobs", ["user_id"])
    op.create_index("ix_import_jobs_status", "import_jobs", ["status"])
    op.create_table(
        "import_pending",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("import_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("release_id", sa.Integer(), nullable=False),
        sa.Column("media_grade", sa.String(4), nullable=True),
        sa.Column("sleeve_grade", sa.String(4), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_import_pending_job_id", "import_pending", ["job_id"])


def downgrade():
    op.drop_index("ix_import_pending_job_id", "import_pending")
    op.drop_table("import_pending")
    op.drop_index("ix_import_jobs_status", "import_jobs")
    op.drop_index("ix_import_jobs_user_id", "import_jobs")
    op.drop_table("import_jobs")
    op.drop_table("discogs_accounts")
