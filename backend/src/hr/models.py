from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Numeric, Date
from sqlalchemy.sql import func
from src.database import Base


class Empleado(Base):
    __tablename__ = "empleados"

    empleado_id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.usuario_id", ondelete="CASCADE"), unique=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    sueldo_base = Column(Numeric(10, 2), nullable=False)
    horas_contrato_mes = Column(Numeric(6, 2), default=160)
    tipo_pension = Column(String(10), default="ONP")  # "AFP" o "ONP"
    porcentaje_afp = Column(Numeric(5, 4), nullable=True)  # Ej: 0.1243 para el total AFP
    cargo = Column(String(100), nullable=True)
    departamento = Column(String(100), nullable=True)
    fecha_ingreso = Column(Date, nullable=True)
    estado = Column(String(20), default="Activo")
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
