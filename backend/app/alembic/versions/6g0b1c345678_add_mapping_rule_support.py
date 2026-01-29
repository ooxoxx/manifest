"""add_mapping_rule_support

Revision ID: 6g0b1c345678
Revises: 5f9a0b234567
Create Date: 2026-01-29 10:00:00.000000

Adds rule_type and class_tag_mapping columns to tagging_rule table
to support mapping rules that tag samples based on annotation class names.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = '6g0b1c345678'
down_revision = '5f9a0b234567'
branch_labels = None
depends_on = None


def upgrade():
    # Add rule_type column with default 'fixed' for existing rules
    op.add_column(
        'tagging_rule',
        sa.Column('rule_type', sa.String(length=50), nullable=False, server_default='fixed')
    )

    # Add class_tag_mapping column for mapping rules
    op.add_column(
        'tagging_rule',
        sa.Column('class_tag_mapping', JSONB, nullable=True)
    )


def downgrade():
    op.drop_column('tagging_rule', 'class_tag_mapping')
    op.drop_column('tagging_rule', 'rule_type')
