from sqlalchemy import Column, Integer, String, Numeric, TIMESTAMP, ForeignKey, Boolean
from sqlalchemy.sql import func
from src.database import Base


class BeneficioSocial(Base):
    """
    Fase 5 — Gratificación (Jul/Dic) y CTS (May/Nov).

    Un solo modelo con `tipo` como discriminador: ambos beneficios comparten la
    misma mecánica de "remuneración computable × proporción de tiempo servido
    en el periodo", solo cambian la fórmula de cómputo y qué descuentos aplican
    (la gratificación paga pensión pero no IR; la CTS es intangible y no paga
    ningún descuento).
    """
    __tablename__ = "beneficios_sociales"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    tipo = Column(String(20), nullable=False)          # Gratificacion | CTS
    periodo = Column(String(7), nullable=False, index=True)  # YYYY-MM del mes de pago (07/12 o 05/11)
    meses_computados = Column(Numeric(4, 2), nullable=False)
    remuneracion_computable = Column(Numeric(10, 2), nullable=False)
    monto_bruto = Column(Numeric(10, 2), nullable=False)
    bonificacion_extraordinaria = Column(Numeric(10, 2), nullable=True, default=0)  # solo Gratificación (Ley 29351)
    aporte_pension = Column(Numeric(10, 2), nullable=True, default=0)               # solo Gratificación
    monto_neto = Column(Numeric(10, 2), nullable=False)
    estado = Column(String(20), nullable=False, default="Calculado")  # Calculado | Pagado
    fecha_calculo = Column(TIMESTAMP, server_default=func.now())
    fecha_pago = Column(TIMESTAMP, nullable=True)
    calculado_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
