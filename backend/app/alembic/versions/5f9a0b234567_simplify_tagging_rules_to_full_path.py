"""simplify_tagging_rules_to_full_path

Revision ID: 5f9a0b234567
Revises: 4e8f9a123456
Create Date: 2026-01-28 10:00:00.000000

Simplifies tagging rules from multiple rule types to single full-path regex.
Pattern now matches against: {bucket}/{object_key}
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '5f9a0b234567'
down_revision = '4e8f9a123456'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Convert existing patterns based on rule_type
    # regex_filename: pattern -> .*/{pattern} (match filename at end of path)
    op.execute("""
        UPDATE tagging_rule
        SET pattern = '.*/' || pattern
        WHERE rule_type = 'regex_filename'
    """)

    # regex_path: keep as-is (already path regex)
    # No change needed for regex_path

    # file_extension: ext -> .*\.{ext}$
    op.execute("""
        UPDATE tagging_rule
        SET pattern = '.*\\.' || pattern || '$'
        WHERE rule_type = 'file_extension'
    """)

    # bucket: bucket_name -> ^{bucket_name}/.*
    op.execute("""
        UPDATE tagging_rule
        SET pattern = '^' || pattern || '/.*'
        WHERE rule_type = 'bucket'
    """)

    # content_type: cannot convert - mark as inactive with note
    op.execute("""
        UPDATE tagging_rule
        SET is_active = false,
            description = COALESCE(description, '') ||
                ' [MIGRATION: content_type rules cannot be converted to path regex]'
        WHERE rule_type = 'content_type'
    """)

    # 2. Drop the rule_type column
    op.drop_column('tagging_rule', 'rule_type')


def downgrade():
    # Add rule_type column back with default value
    op.add_column(
        'tagging_rule',
        sa.Column('rule_type', sa.String(length=50), nullable=False,
                  server_default='regex_path')
    )

    # Remove server default after adding
    op.alter_column('tagging_rule', 'rule_type', server_default=None)
