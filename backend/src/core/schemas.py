from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# --- Esquemas para Notificaciones ---

class NotificacionBase(BaseModel):
    titulo: str
    mensaje: str

class NotificacionCreate(NotificacionBase):
    pass

class NotificacionResponse(NotificacionBase):
    notificacion_id: int
    empresa_id: int
    leido: bool
    fecha_creacion: datetime

    class Config:
        from_attributes = True

# --- Esquemas para Auditorías Programadas ---

class AuditoriaProgramadaBase(BaseModel):
    nombre_auditoria: str
    descripcion: Optional[str] = None
    fecha_programada: datetime

class AuditoriaProgramadaCreate(AuditoriaProgramadaBase):
    pass

class AuditoriaProgramadaResponse(AuditoriaProgramadaBase):
    auditoria_id: int
    empresa_id: int
    estado: str
    fecha_creacion: datetime

    class Config:
        from_attributes = True
