from sqlalchemy import Column, Integer, String, Numeric, TIMESTAMP, ForeignKey, Date, Boolean
from sqlalchemy.sql import func
from src.database import Base


class Liquidacion(Base):
    """
    Fase 5 — Liquidación por cese: vacaciones truncas + gratificación trunca +
    CTS trunca, calculadas con las mismas fórmulas que sus contrapartes
    "en curso" (vacaciones_calculo, calcular_gratificacion, calcular_cts),
    acotadas a la fracción de tiempo servida hasta la fecha de cese.
    """
    __tablename__ = "liquidaciones"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    fecha_cese = Column(Date, nullable=False)
    motivo = Column(String(30), nullable=False, default="Renuncia")  # Renuncia | Despido | Mutuo_acuerdo | Fin_contrato

    dias_vacaciones_truncas = Column(Integer, nullable=False, default=0)
    monto_vacaciones_truncas = Column(Numeric(10, 2), nullable=False, default=0)

    meses_gratificacion_trunca = Column(Numeric(4, 2), nullable=False, default=0)
    monto_gratificacion_trunca = Column(Numeric(10, 2), nullable=False, default=0)
    bonificacion_extraordinaria = Column(Numeric(10, 2), nullable=False, default=0)

    meses_cts_trunca = Column(Numeric(4, 2), nullable=False, default=0)
    monto_cts_trunca = Column(Numeric(10, 2), nullable=False, default=0)

    monto_total = Column(Numeric(10, 2), nullable=False)
    estado = Column(String(20), nullable=False, default="Calculada")  # Calculada | Pagada
    fecha_calculo = Column(TIMESTAMP, server_default=func.now())
    fecha_pago = Column(TIMESTAMP, nullable=True)
    calculado_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
