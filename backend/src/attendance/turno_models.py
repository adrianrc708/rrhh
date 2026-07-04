from sqlalchemy import Column, Integer, String, Time, ForeignKey, TIMESTAMP, Date
from sqlalchemy.sql import func
from src.database import Base


class Turno(Base):
    __tablename__ = "turnos"

    turno_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    nombre = Column(String(100), nullable=False)           # Ej: "Turno Mañana"
    hora_entrada = Column(String(5), nullable=False)       # Ej: "08:00"
    hora_salida = Column(String(5), nullable=False)        # Ej: "17:00"
    descripcion = Column(String(200), nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())


class AsignacionTurno(Base):
    __tablename__ = "asignaciones_turno"

    asignacion_id = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"))
    turno_id = Column(Integer, ForeignKey("turnos.turno_id", ondelete="CASCADE"))
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())