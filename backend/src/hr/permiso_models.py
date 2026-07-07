from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Text, Date, Numeric, Boolean
from sqlalchemy.sql import func
from src.database import Base


class SolicitudPermiso(Base):
    """
    Fase 5 — Autogestión de permisos y descansos médicos con documento adjunto.

    Al aprobarse, se materializa como un registro real en `Inasistencia`
    (attendance/models.py) para no duplicar la lógica de descuentos que ya
    consume ese modelo en la consolidación de planilla.
    """
    __tablename__ = "solicitudes_permiso"

    solicitud_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    tipo = Column(String(30), nullable=False)  # Justificada | Permiso_sin_goce | Permiso_con_goce | Licencia
    fecha = Column(Date, nullable=False)
    horas = Column(Numeric(4, 2), nullable=False, default=8.0)
    observaciones = Column(Text, nullable=True)
    documento_path = Column(String(300), nullable=True)
    documento_nombre = Column(String(200), nullable=True)
    estado = Column(String(15), nullable=False, default="Pendiente")  # Pendiente | Aprobada | Rechazada | Cancelada
    motivo_rechazo = Column(Text, nullable=True)
    inasistencia_id = Column(Integer, ForeignKey("inasistencias.inasistencia_id", ondelete="SET NULL"), nullable=True)
    resuelto_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    fecha_resolucion = Column(TIMESTAMP, nullable=True)
    fecha_solicitud = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
