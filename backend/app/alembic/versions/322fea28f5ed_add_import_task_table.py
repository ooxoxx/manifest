"""add_import_task_table

Revision ID: 322fea28f5ed
Revises: 3b56cf012345
Create Date: 2026-01-17 16:25:39.286665

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '322fea28f5ed'
down_revision = '3b56cf012345'
branch_labels = None
depends_on = None


def upgrade():
    # Create import_task table
    op.create_table('import_task',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('owner_id', sa.Uuid(), nullable=False),
    sa.Column('minio_instance_id', sa.Uuid(), nullable=False),
    sa.Column('bucket', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
    sa.Column('total_rows', sa.Integer(), nullable=False),
    sa.Column('progress', sa.Integer(), nullable=False),
    sa.Column('created', sa.Integer(), nullable=False),
    sa.Column('skipped', sa.Integer(), nullable=False),
    sa.Column('errors', sa.Integer(), nullable=False),
    sa.Column('annotations_linked', sa.Integer(), nullable=False),
    sa.Column('tags_created', sa.Integer(), nullable=False),
    sa.Column('error_details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['minio_instance_id'], ['minio_instance.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_import_task_created_at'), 'import_task', ['created_at'], unique=False)

    # Convert extra_data and sample_history.details from JSON to JSONB for better query support
    op.alter_column('sample', 'extra_data',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('sample_history', 'details',
               existing_type=postgresql.JSON(astext_type=sa.Text()),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True)


def downgrade():
    op.alter_column('sample_history', 'details',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=postgresql.JSON(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('sample', 'extra_data',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=postgresql.JSON(astext_type=sa.Text()),
               existing_nullable=True)
    op.drop_index(op.f('ix_import_task_created_at'), table_name='import_task')
    op.drop_table('import_task')
