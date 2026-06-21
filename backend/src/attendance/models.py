from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Numeric, Text, Date
from sqlalchemy.sql import func
from src.database import Base

# Tipos válidos de inasistencia
TIPOS_INASISTENCIA = [
    "Injustificada",
    "Justificada",
    "Permiso_sin_goce",
    "Permiso_con_goce",
    "Licencia",
]

# Solo estos tipos generan descuento en el sueldo (RF-17)
TIPOS_QUE_DESCUENTAN = {"Injustificada", "Permiso_sin_goce"}


class Inasistencia(Base):
    __tablename__ = "inasistencias"

    inasistencia_id = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"))
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    fecha = Column(Date, nullable=False)
    tipo = Column(String(50), nullable=False)
    horas_ausentes = Column(Numeric(4, 2), default=8.0)
    periodo = Column(String(7), nullable=False)  # YYYY-MM, derivado de fecha
    observaciones = Column(Text, nullable=True)
    registrado_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    fecha_registro = Column(TIMESTAMP, server_default=func.now())
