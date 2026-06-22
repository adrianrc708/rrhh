"""agregar_columna_nombre_empleado

Revision ID: 4ad8a3b02eab
Revises: 038af17dce13
Create Date: 2026-06-22 07:11:22.900977

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4ad8a3b02eab'
down_revision: Union[str, Sequence[str], None] = '038af17dce13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Registra la inserción de la columna para tus compañeros
    op.add_column('empleados', sa.Column('nombre', sa.String(length=150), nullable=True))


def downgrade() -> None:
    # Registra cómo revertir el cambio si fuera necesario
    op.drop_column('empleados', 'nombre')
