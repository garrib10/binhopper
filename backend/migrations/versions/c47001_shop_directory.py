"""Stable shop directory keys, verification and soft deactivation."""
from alembic import op
import sqlalchemy as sa

revision = 'c47001'
down_revision = 'c49001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('stores', sa.Column('shop_key', sa.String(255), nullable=True))
    stores = sa.table('stores', sa.column('id', sa.Integer), sa.column('shop_key', sa.String(255)))
    conn = op.get_bind()
    for identifier in conn.execute(sa.select(stores.c.id)).scalars().all():
        conn.execute(stores.update().where(stores.c.id == identifier).values(shop_key=f'legacy-{identifier}'))
    with op.batch_alter_table('stores') as batch:
        batch.alter_column('shop_key', existing_type=sa.String(255), nullable=False)
        batch.create_unique_constraint('uq_stores_shop_key', ['shop_key'])
        batch.add_column(sa.Column('osm_id', sa.String(40), nullable=True))
        batch.create_unique_constraint('uq_stores_osm_id', ['osm_id'])
        batch.add_column(sa.Column('active', sa.Boolean(), nullable=False, server_default='1'))
        batch.add_column(sa.Column('verified_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('stores') as batch:
        batch.drop_column('verified_at')
        batch.drop_column('active')
        batch.drop_constraint('uq_stores_osm_id', type_='unique')
        batch.drop_column('osm_id')
        batch.drop_constraint('uq_stores_shop_key', type_='unique')
        batch.drop_column('shop_key')
