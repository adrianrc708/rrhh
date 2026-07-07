"""
Fase 7 — Auditoría técnica global (cross-tenant).

A diferencia de EventoAuditoria (transaccional, por empresa), este registro es de
infraestructura: errores del backend, intentos de inyección y señales de seguridad
a nivel plataforma. Solo lo consulta el SuperAdmin.
"""
from sqlalchemy import Column, Integer, String, TIMESTAMP, Text
from sqlalchemy.sql import func
from src.database import Base


class LogTecnico(Base):
    __tablename__ = "logs_tecnicos"

    id = Column(Integer, primary_key=True, index=True)
    nivel = Column(String(15), nullable=False, index=True)   # ERROR | SECURITY | WARN
    empresa_id = Column(Integer, nullable=True, index=True)  # sin FK: sobrevive al borrado del tenant
    usuario_id = Column(Integer, nullable=True)
    metodo = Column(String(10), nullable=True)
    ruta = Column(String(300), nullable=True)
    status_code = Column(Integer, nullable=True)
    mensaje = Column(Text, nullable=True)
    ip = Column(String(45), nullable=True)
    fecha_evento = Column(TIMESTAMP, server_default=func.now())
