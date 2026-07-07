"""
Fase 7 — Administración del SaaS y permisos.

Tablas nuevas:
  - PermisosUsuario : override de secciones visibles por usuario (roles personalizados
    "por sección"). Si un usuario tiene una fila, sustituye a las secciones por rol.
  - Derechohabiente : cónyuge/hijos del trabajador (alta/baja para EsSalud).
  - SolicitudCambioDatos : petición del empleado para actualizar sus datos maestros
    (cuenta bancaria, domicilio, derechohabientes); RRHH la aprueba y se aplica.
"""
from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Text, Boolean, Date
from sqlalchemy.sql import func
from src.database import Base


class PermisosUsuario(Base):
    __tablename__ = "permisos_usuario"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.usuario_id", ondelete="CASCADE"), unique=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    # Lista de section keys separadas por coma (p. ej. "dashboard,personal,nomina").
    secciones = Column(Text, nullable=False, default="")
    actualizado_por = Column(Integer, ForeignKey("usuarios.usuario_id", ondelete="SET NULL"), nullable=True)
    fecha_actualizacion = Column(TIMESTAMP, server_default=func.now())


class Derechohabiente(Base):
    __tablename__ = "derechohabientes"

    derechohabiente_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    nombre = Column(String(150), nullable=False)
    parentesco = Column(String(20), nullable=False, default="Hijo")   # Conyuge | Hijo
    tipo_documento = Column(String(20), nullable=True, default="DNI")
    numero_documento = Column(String(20), nullable=True)
    fecha_nacimiento = Column(Date, nullable=True)
    estado = Column(String(15), default="Activo", nullable=False)     # Activo | Inactivo
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


TIPOS_CAMBIO = ["Bancario", "Domicilio", "Derechohabiente"]


class SolicitudCambioDatos(Base):
    __tablename__ = "solicitudes_cambio_datos"

    solicitud_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    tipo_cambio = Column(String(20), nullable=False)   # Bancario | Domicilio | Derechohabiente
    # Datos propuestos, serializados en JSON (depende del tipo_cambio).
    payload = Column(Text, nullable=False)
    estado = Column(String(15), default="Pendiente", nullable=False, index=True)  # Pendiente | Aprobada | Rechazada
    resuelto_por = Column(Integer, ForeignKey("usuarios.usuario_id", ondelete="SET NULL"), nullable=True)
    comentario = Column(Text, nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    fecha_resolucion = Column(TIMESTAMP, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
