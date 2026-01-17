"""Add manifest models

Revision ID: 2a45bf901234
Revises: 1a31ce608336
Create Date: 2026-01-16 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '2a45bf901234'
down_revision = '1a31ce608336'
branch_labels = None
depends_on = None


def upgrade():
    # Drop item table (replaced by sample)
    op.drop_table('item')

    # Create minio_instance table
    op.create_table(
        'minio_instance',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('endpoint', sqlmodel.sql.sqltypes.AutoString(length=512), nullable=False),
        sa.Column('secure', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=1024), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('access_key_encrypted', sqlmodel.sql.sqltypes.AutoString(length=512), nullable=False),
        sa.Column('secret_key_encrypted', sqlmodel.sql.sqltypes.AutoString(length=512), nullable=False),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_minio_instance_name', 'minio_instance', ['name'], unique=False)

    # Create watched_path table
    op.create_table(
        'watched_path',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('bucket', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('prefix', sqlmodel.sql.sqltypes.AutoString(length=1024), nullable=False, server_default=''),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=1024), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('minio_instance_id', sa.UUID(), nullable=False),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['minio_instance_id'], ['minio_instance.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create tag table
    op.create_table(
        'tag',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('color', sqlmodel.sql.sqltypes.AutoString(length=7), nullable=True),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=1024), nullable=True),
        sa.Column('parent_id', sa.UUID(), nullable=True),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['parent_id'], ['tag.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tag_name', 'tag', ['name'], unique=False)

    # Create sample table
    op.create_table(
        'sample',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('object_key', sqlmodel.sql.sqltypes.AutoString(length=1024), nullable=False),
        sa.Column('bucket', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('file_name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('content_type', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column('etag', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('minio_instance_id', sa.UUID(), nullable=False),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False, server_default='active'),
        sa.Column('source', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False, server_default='manual'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['minio_instance_id'], ['minio_instance.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sample_object_key', 'sample', ['object_key'], unique=False)
    op.create_index('ix_sample_bucket', 'sample', ['bucket'], unique=False)
    op.create_index('ix_sample_status', 'sample', ['status'], unique=False)
    op.create_index('ix_sample_created_at', 'sample', ['created_at'], unique=False)

    # Create sample_tag association table
    op.create_table(
        'sample_tag',
        sa.Column('sample_id', sa.UUID(), nullable=False),
        sa.Column('tag_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['sample_id'], ['sample.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tag.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('sample_id', 'tag_id'),
    )

    # Create dataset table
    op.create_table(
        'dataset',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=2048), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('sample_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_dataset_name', 'dataset', ['name'], unique=False)

    # Create dataset_sample association table
    op.create_table(
        'dataset_sample',
        sa.Column('dataset_id', sa.UUID(), nullable=False),
        sa.Column('sample_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['dataset.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sample_id'], ['sample.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('dataset_id', 'sample_id'),
    )

    # Create sample_history table
    op.create_table(
        'sample_history',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('sample_id', sa.UUID(), nullable=False),
        sa.Column('action', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['sample_id'], ['sample.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sample_history_created_at', 'sample_history', ['created_at'], unique=False)


def downgrade():
    # Drop tables in reverse order
    op.drop_index('ix_sample_history_created_at', table_name='sample_history')
    op.drop_table('sample_history')
    op.drop_table('dataset_sample')
    op.drop_index('ix_dataset_name', table_name='dataset')
    op.drop_table('dataset')
    op.drop_table('sample_tag')
    op.drop_index('ix_sample_created_at', table_name='sample')
    op.drop_index('ix_sample_status', table_name='sample')
    op.drop_index('ix_sample_bucket', table_name='sample')
    op.drop_index('ix_sample_object_key', table_name='sample')
    op.drop_table('sample')
    op.drop_index('ix_tag_name', table_name='tag')
    op.drop_table('tag')
    op.drop_table('watched_path')
    op.drop_index('ix_minio_instance_name', table_name='minio_instance')
    op.drop_table('minio_instance')

    # Recreate item table
    op.create_table(
        'item',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
