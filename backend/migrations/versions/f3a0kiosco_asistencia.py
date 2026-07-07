"""fase3_kiosco_asistencia: dispositivos, rostros, marcaciones, ciclos y cierres

Revision ID: f3a0kiosco
Revises: f2a0motornomina
Create Date: 2026-07-06

Fase 3 (Asistencia + Kiosco facial):
- dispositivos_kiosco, rostros_empleado, marcaciones, ciclos_jornada, cierres_asistencia.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3a0kiosco'
down_revision: Union[str, Sequence[str], None] = 'f2a0motornomina'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dispositivos_kiosco",
        sa.Column("dispositivo_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("empresa_id", sa.Integer(), sa.ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("pin_hash", sa.Text(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("ultimo_uso", sa.TIMESTAMP(), nullable=True),
        sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_dispositivos_kiosco_is_deleted", "dispositivos_kiosco", ["is_deleted"])

    op.create_table(
        "rostros_empleado",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("empresa_id", sa.Integer(), sa.ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True),
        sa.Column("empleado_id", sa.Integer(), sa.ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True),
        sa.Column("descriptor", sa.Text(), nullable=False),
        sa.Column("etiqueta", sa.String(length=50), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_rostros_empleado_is_deleted", "rostros_empleado", ["is_deleted"])

    op.create_table(
        "marcaciones",
        sa.Column("marcacion_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("empresa_id", sa.Integer(), sa.ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True),
        sa.Column("empleado_id", sa.Integer(), sa.ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True),
        sa.Column("tipo", sa.String(length=10), nullable=False),
        sa.Column("momento", sa.TIMESTAMP(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False, index=True),
        sa.Column("periodo", sa.String(length=7), nullable=False, index=True),
        sa.Column("origen", sa.String(length=10), nullable=False, server_default="kiosco"),
        sa.Column("dispositivo_id", sa.Integer(), sa.ForeignKey("dispositivos_kiosco.dispositivo_id", ondelete="SET NULL"), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("distancia_match", sa.Float(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_marcaciones_is_deleted", "marcaciones", ["is_deleted"])

    op.create_table(
        "ciclos_jornada",
        sa.Column("ciclo_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("empresa_id", sa.Integer(), sa.ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True),
        sa.Column("empleado_id", sa.Integer(), sa.ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.Column("dias_trabajo", sa.Integer(), nullable=False),
        sa.Column("dias_descanso", sa.Integer(), nullable=False),
        sa.Column("fecha_inicio_ciclo", sa.Date(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_ciclos_jornada_is_deleted", "ciclos_jornada", ["is_deleted"])

    op.create_table(
        "cierres_asistencia",
        sa.Column("cierre_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("empresa_id", sa.Integer(), sa.ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True),
        sa.Column("periodo", sa.String(length=7), nullable=False, index=True),
        sa.Column("estado", sa.String(length=15), nullable=False, server_default="Abierto"),
        sa.Column("cerrado_por", sa.Integer(), sa.ForeignKey("usuarios.usuario_id"), nullable=True),
        sa.Column("fecha_cierre", sa.TIMESTAMP(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("cierres_asistencia")
    op.drop_index("ix_ciclos_jornada_is_deleted", table_name="ciclos_jornada")
    op.drop_table("ciclos_jornada")
    op.drop_index("ix_marcaciones_is_deleted", table_name="marcaciones")
    op.drop_table("marcaciones")
    op.drop_index("ix_rostros_empleado_is_deleted", table_name="rostros_empleado")
    op.drop_table("rostros_empleado")
    op.drop_index("ix_dispositivos_kiosco_is_deleted", table_name="dispositivos_kiosco")
    op.drop_table("dispositivos_kiosco")
