"""redesign_tag_categories

Revision ID: 4e8f9a123456
Revises: 0cd235f61b7a
Create Date: 2026-01-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '4e8f9a123456'
down_revision = '0cd235f61b7a'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add new fields to tag table
    op.add_column('tag', sa.Column('business_code', sa.String(length=100), nullable=True))
    op.add_column('tag', sa.Column('level', sa.Integer(), server_default='0', nullable=False))
    op.add_column('tag', sa.Column('full_path', sa.String(length=1024), nullable=True))
    op.add_column('tag', sa.Column('system_tag_type', sa.String(length=50), nullable=True))

    # 2. Create index on business_code
    op.create_index(op.f('ix_tag_business_code'), 'tag', ['business_code'], unique=False)

    # 3. Make owner_id nullable (for global business tags)
    op.alter_column('tag', 'owner_id', existing_type=sa.UUID(), nullable=True)

    # 4. Create tagging_rule table
    op.create_table(
        'tagging_rule',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=1024), nullable=True),
        sa.Column('rule_type', sa.String(length=50), nullable=False),
        sa.Column('pattern', sa.String(length=1024), nullable=False),
        sa.Column('tag_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('auto_execute', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 5. Mark existing system/business tags as system_managed
    op.execute("""
        UPDATE tag SET is_system_managed = true
        WHERE category IN ('system', 'business')
    """)


def downgrade():
    # Drop tagging_rule table
    op.drop_table('tagging_rule')

    # Drop index
    op.drop_index(op.f('ix_tag_business_code'), table_name='tag')

    # Make owner_id NOT NULL again
    op.alter_column('tag', 'owner_id', existing_type=sa.UUID(), nullable=False)

    # Drop new columns
    op.drop_column('tag', 'system_tag_type')
    op.drop_column('tag', 'full_path')
    op.drop_column('tag', 'level')
    op.drop_column('tag', 'business_code')
