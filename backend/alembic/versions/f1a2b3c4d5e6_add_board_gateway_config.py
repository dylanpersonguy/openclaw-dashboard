"""add board gateway config

Revision ID: f1a2b3c4d5e6
Revises: e4f5a6b7c8d9
Create Date: 2026-02-04 00:00:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "e4f5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("boards", sa.Column("gateway_url", sa.String(), nullable=True))
    op.add_column("boards", sa.Column("gateway_token", sa.String(), nullable=True))
    op.add_column(
        "boards", sa.Column("gateway_main_session_key", sa.String(), nullable=True)
    )
    op.add_column(
        "boards", sa.Column("gateway_workspace_root", sa.String(), nullable=True)
    )

    op.add_column("agents", sa.Column("board_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "agents_board_id_fkey", "agents", "boards", ["board_id"], ["id"]
    )
    op.create_index(op.f("ix_agents_board_id"), "agents", ["board_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_agents_board_id"), table_name="agents")
    op.drop_constraint("agents_board_id_fkey", "agents", type_="foreignkey")
    op.drop_column("agents", "board_id")

    op.drop_column("boards", "gateway_workspace_root")
    op.drop_column("boards", "gateway_main_session_key")
    op.drop_column("boards", "gateway_token")
    op.drop_column("boards", "gateway_url")
