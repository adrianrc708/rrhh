"""fundamentos_fase1: jefe_id, soft-delete global y parametros_fiscales

Revision ID: f1a0fundamentos
Revises: bf73f84f8107
Create Date: 2026-07-06

Fase 1 (Fundamentos):
- Empleado.jefe_id: línea de mando por persona (aislamiento jerárquico).
- is_deleted en todas las tablas de negocio (borrado lógico).
- Tabla parametros_fiscales (RMV/UIT/tasas versionadas).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a0fundamentos'
down_revision: Union[str, Sequence[str], None] = 'bf73f84f8107'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tablas que reciben la columna is_deleted.
TABLAS_SOFT_DELETE = [
    "empresas",
    "usuarios",
    "nominas",
    "detalles_nomina",
    "pagos",
    "notificaciones",
    "departamentos",
    "cargos",
    "contratos",
]


def upgrade() -> None:
    # 1) Soft-delete global. server_default='false' rellena filas existentes.
    for tabla in TABLAS_SOFT_DELETE:
        op.add_column(
            tabla,
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.create_index(f"ix_{tabla}_is_deleted", tabla, ["is_deleted"])

    # 2) Línea de mando por persona.
    op.add_column("empleados", sa.Column("jefe_id", sa.Integer(), nullable=True))
    op.add_column(
        "empleados",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_empleados_jefe_id", "empleados", ["jefe_id"])
    op.create_index("ix_empleados_is_deleted", "empleados", ["is_deleted"])
    op.create_foreign_key(
        "fk_empleados_jefe_id",
        "empleados", "empleados",
        ["jefe_id"], ["empleado_id"],
        ondelete="SET NULL",
    )

    # 3) Parámetros fiscales versionados.
    op.create_table(
        "parametros_fiscales",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("clave", sa.String(length=50), nullable=False, index=True),
        sa.Column("valor", sa.Numeric(14, 6), nullable=False),
        sa.Column("descripcion", sa.String(length=200), nullable=True),
        sa.Column("vigencia_desde", sa.Date(), nullable=False),
        sa.Column("vigencia_hasta", sa.Date(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("creado_por", sa.Integer(), sa.ForeignKey("usuarios.usuario_id"), nullable=True),
        sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("parametros_fiscales")

    op.drop_constraint("fk_empleados_jefe_id", "empleados", type_="foreignkey")
    op.drop_index("ix_empleados_is_deleted", table_name="empleados")
    op.drop_index("ix_empleados_jefe_id", table_name="empleados")
    op.drop_column("empleados", "is_deleted")
    op.drop_column("empleados", "jefe_id")

    for tabla in reversed(TABLAS_SOFT_DELETE):
        op.drop_index(f"ix_{tabla}_is_deleted", table_name=tabla)
        op.drop_column(tabla, "is_deleted")
