from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'aaa001turnos'
down_revision: Union[str, Sequence[str], None] = 'bcc1487d292f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'turnos',
        sa.Column('turno_id', sa.Integer(), nullable=False),
        sa.Column('empresa_id', sa.Integer(), nullable=True),
        sa.Column('nombre', sa.String(length=100), nullable=False),
        sa.Column('hora_entrada', sa.String(length=5), nullable=False),
        sa.Column('hora_salida', sa.String(length=5), nullable=False),
        sa.Column('descripcion', sa.String(length=200), nullable=True),
        sa.Column('fecha_creacion', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['empresa_id'], ['empresas.empresa_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('turno_id'),
    )
    op.create_index(op.f('ix_turnos_turno_id'), 'turnos', ['turno_id'], unique=False)

    op.create_table(
        'asignaciones_turno',
        sa.Column('asignacion_id', sa.Integer(), nullable=False),
        sa.Column('empleado_id', sa.Integer(), nullable=True),
        sa.Column('turno_id', sa.Integer(), nullable=True),
        sa.Column('fecha_inicio', sa.Date(), nullable=False),
        sa.Column('fecha_fin', sa.Date(), nullable=True),
        sa.Column('fecha_creacion', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['empleado_id'], ['empleados.empleado_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['turno_id'], ['turnos.turno_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('asignacion_id'),
    )
    op.create_index(op.f('ix_asignaciones_turno_asignacion_id'), 'asignaciones_turno', ['asignacion_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_asignaciones_turno_asignacion_id'), table_name='asignaciones_turno')
    op.drop_table('asignaciones_turno')
    op.drop_index(op.f('ix_turnos_turno_id'), table_name='turnos')
    op.drop_table('turnos')