from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Text, Date, Boolean
from sqlalchemy.sql import func
from src.database import Base


class SolicitudVacaciones(Base):
    """
    Fase 5 — Solicitud de descanso vacacional (autogestión del empleado).

    El saldo disponible NO se persiste como contador aparte: se calcula al vuelo
    a partir de `Empleado.fecha_ingreso` (2.5 días devengados por mes completo de
    servicio, D.L. 713) menos los días de las solicitudes Pendientes/Aprobadas.
    Esto evita que un contador quede desincronizado del historial real.
    """
    __tablename__ = "solicitudes_vacaciones"

    solicitud_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    dias_solicitados = Column(Integer, nullable=False)
    estado = Column(String(15), nullable=False, default="Pendiente")  # Pendiente | Aprobada | Rechazada | Cancelada
    motivo_rechazo = Column(Text, nullable=True)
    resuelto_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    fecha_resolucion = Column(TIMESTAMP, nullable=True)
    fecha_solicitud = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
