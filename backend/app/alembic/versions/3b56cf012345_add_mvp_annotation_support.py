"""Add MVP annotation support

Revision ID: 3b56cf012345
Revises: 2a45bf901234
Create Date: 2026-01-17 14:16:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = '3b56cf012345'
down_revision = '2a45bf901234'
branch_labels = None
depends_on = None


def upgrade():
    # First, fix metadata -> extra_data column rename in sample table
    op.alter_column('sample', 'metadata', new_column_name='extra_data')

    # Create annotation table
    op.create_table(
        'annotation',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('format', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False, server_default='voc'),
        sa.Column('image_width', sa.Integer(), nullable=True),
        sa.Column('image_height', sa.Integer(), nullable=True),
        sa.Column('object_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('class_counts', JSONB, nullable=True),
        sa.Column('objects', JSONB, nullable=True),
        sa.Column('sample_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['sample_id'], ['sample.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sample_id', name='uq_annotation_sample_id'),
    )
    op.create_index('ix_annotation_object_count', 'annotation', ['object_count'], unique=False)

    # Add annotation-related columns to sample table
    op.add_column('sample', sa.Column('file_hash', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True))
    op.add_column('sample', sa.Column('file_stem', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True))
    op.add_column('sample', sa.Column('annotation_key', sqlmodel.sql.sqltypes.AutoString(length=1024), nullable=True))
    op.add_column('sample', sa.Column('annotation_hash', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True))
    op.add_column('sample', sa.Column('annotation_status', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False, server_default='none'))
    op.add_column('sample', sa.Column('annotation_id', sa.UUID(), nullable=True))

    # Create indexes for new sample columns
    op.create_index('ix_sample_file_hash', 'sample', ['file_hash'], unique=False)
    op.create_index('ix_sample_file_stem', 'sample', ['file_stem'], unique=False)

    # Add foreign key constraint for annotation_id
    op.create_foreign_key(
        'fk_sample_annotation_id',
        'sample', 'annotation',
        ['annotation_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade():
    # Drop foreign key constraint
    op.drop_constraint('fk_sample_annotation_id', 'sample', type_='foreignkey')

    # Drop indexes
    op.drop_index('ix_sample_file_stem', table_name='sample')
    op.drop_index('ix_sample_file_hash', table_name='sample')

    # Drop annotation columns from sample table
    op.drop_column('sample', 'annotation_id')
    op.drop_column('sample', 'annotation_status')
    op.drop_column('sample', 'annotation_hash')
    op.drop_column('sample', 'annotation_key')
    op.drop_column('sample', 'file_stem')
    op.drop_column('sample', 'file_hash')

    # Drop annotation table
    op.drop_index('ix_annotation_object_count', table_name='annotation')
    op.drop_table('annotation')

    # Revert extra_data -> metadata column rename
    op.alter_column('sample', 'extra_data', new_column_name='metadata')
