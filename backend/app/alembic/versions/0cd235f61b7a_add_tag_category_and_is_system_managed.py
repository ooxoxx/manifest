"""add_tag_category_and_is_system_managed

Revision ID: 0cd235f61b7a
Revises: 322fea28f5ed
Create Date: 2026-01-26 09:33:05.377773

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '0cd235f61b7a'
down_revision = '322fea28f5ed'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add category column (nullable for now)
    op.add_column('tag', sa.Column('category', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True))

    # 2. Add is_system_managed column with default False
    op.add_column('tag', sa.Column('is_system_managed', sa.Boolean(), server_default='false', nullable=False))

    # 3. Data migration - categorize existing tags based on naming patterns
    # System tags: tags starting with 已/待 or ending with 平台/系统
    op.execute("""
        UPDATE tag SET category = 'system'
        WHERE name LIKE '已%' OR name LIKE '待%'
           OR name LIKE '%平台' OR name LIKE '%系统'
    """)

    # Business tags: known business domain terms
    op.execute("""
        UPDATE tag SET category = 'business'
        WHERE name IN ('输电', '配电', '变电', '通道监拍', '无人机巡检', '施工机械', '塔吊')
    """)

    # User tags: everything else
    op.execute("""
        UPDATE tag SET category = 'user' WHERE category IS NULL
    """)

    # 4. Set NOT NULL constraint on category
    op.alter_column('tag', 'category', nullable=False)

    # 5. Create index on category for better query performance
    op.create_index(op.f('ix_tag_category'), 'tag', ['category'], unique=False)


def downgrade():
    # Drop index
    op.drop_index(op.f('ix_tag_category'), table_name='tag')

    # Drop columns
    op.drop_column('tag', 'is_system_managed')
    op.drop_column('tag', 'category')
