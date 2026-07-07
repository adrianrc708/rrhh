from sqlalchemy import Column, Integer, String, Numeric, TIMESTAMP, ForeignKey, Boolean
from sqlalchemy.sql import func
from src.database import Base


class ConceptoVariable(Base):
    """
    Fase 5 — Conceptos variables de planilla: comisiones, adelantos y préstamos.

    - Comision: se abona íntegra como haber en el `periodo` indicado.
    - Adelanto: se otorga en `periodo` y se descuenta completo en ese mismo
      periodo de planilla (cuotas=1).
    - Prestamo: se otorga en `periodo` y se descuenta en cuotas iguales
      (monto/cuotas) en las `cuotas` planillas consecutivas siguientes,
      calculado sobre la marcha a partir de la distancia entre `periodo`
      del préstamo y el periodo de la nómina que se está consolidando
      (sin tabla de aplicaciones aparte, mismo criterio que HorasPeriodo).
    """
    __tablename__ = "conceptos_variables"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    tipo = Column(String(20), nullable=False)  # Comision | Adelanto | Prestamo
    periodo = Column(String(7), nullable=False, index=True)  # YYYY-MM de abono/otorgamiento
    monto = Column(Numeric(10, 2), nullable=False)
    cuotas = Column(Integer, nullable=False, default=1)
    descripcion = Column(String(200), nullable=True)
    estado = Column(String(20), nullable=False, default="Activo")  # Activo | Cancelado
    registrado_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    fecha_registro = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
