"""fase2_motor_nomina: regimen, perfil, segmentacion horaria y auditoria normativa

Revision ID: f2a0motornomina
Revises: f1a0fundamentos
Create Date: 2026-07-06

Fase 2 (Motor de nómina):
- Empresa.regimen_laboral y Contrato.perfil_contrato.
- Columnas de segmentación horaria y bono sectorial en detalles_nomina.
- Tablas horas_periodo (captura manual) y alertas_normativas (auditoría).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a0motornomina'
down_revision: Union[str, Sequence[str], None] = 'f1a0fundamentos'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Régimen y perfil sectorial.
    op.add_column("empresas", sa.Column("regimen_laboral", sa.String(length=20), nullable=False, server_default="General"))
    op.add_column("contratos", sa.Column("perfil_contrato", sa.String(length=20), nullable=False, server_default="Comun"))

    # 2) Conceptos de segmentación horaria y bono sectorial en la boleta.
    op.add_column("detalles_nomina", sa.Column("perfil_contrato", sa.String(length=20), nullable=True))
    op.add_column("detalles_nomina", sa.Column("pago_horas_extra_25", sa.Numeric(10, 2), nullable=True, server_default="0"))
    op.add_column("detalles_nomina", sa.Column("pago_horas_extra_35", sa.Numeric(10, 2), nullable=True, server_default="0"))
    op.add_column("detalles_nomina", sa.Column("pago_horas_nocturnas", sa.Numeric(10, 2), nullable=True, server_default="0"))
    op.add_column("detalles_nomina", sa.Column("bonos_sector", sa.Numeric(10, 2), nullable=True, server_default="0"))

    # 3) Captura manual de horas por empleado/periodo.
    op.create_table(
        "horas_periodo",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("empresa_id", sa.Integer(), sa.ForeignKey("empresas.empresa_id", ondelete="CASCADE")),
        sa.Column("empleado_id", sa.Integer(), sa.ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True),
        sa.Column("periodo", sa.String(length=7), nullable=False, index=True),
        sa.Column("horas_extra_25", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("horas_extra_35", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("horas_nocturnas", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("registrado_por", sa.Integer(), sa.ForeignKey("usuarios.usuario_id"), nullable=True),
        sa.Column("fecha_registro", sa.TIMESTAMP(), server_default=sa.func.now()),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_horas_periodo_is_deleted", "horas_periodo", ["is_deleted"])

    # 4) Alertas de la auditoría normativa.
    op.create_table(
        "alertas_normativas",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("nomina_id", sa.Integer(), sa.ForeignKey("nominas.id", ondelete="CASCADE"), index=True),
        sa.Column("empleado_id", sa.Integer(), sa.ForeignKey("empleados.empleado_id", ondelete="SET NULL"), nullable=True),
        sa.Column("nivel", sa.String(length=15), nullable=False),
        sa.Column("concepto", sa.String(length=60), nullable=False),
        sa.Column("mensaje", sa.Text(), nullable=False),
        sa.Column("explicacion", sa.Text(), nullable=True),
        sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("alertas_normativas")
    op.drop_index("ix_horas_periodo_is_deleted", table_name="horas_periodo")
    op.drop_table("horas_periodo")

    op.drop_column("detalles_nomina", "bonos_sector")
    op.drop_column("detalles_nomina", "pago_horas_nocturnas")
    op.drop_column("detalles_nomina", "pago_horas_extra_35")
    op.drop_column("detalles_nomina", "pago_horas_extra_25")
    op.drop_column("detalles_nomina", "perfil_contrato")

    op.drop_column("contratos", "perfil_contrato")
    op.drop_column("empresas", "regimen_laboral")
