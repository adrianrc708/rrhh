from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# --- Esquema de Registro Público (nueva empresa + admin + pago del plan) ---

class RegistroEmpresaCreate(BaseModel):
    empresa_nombre: str
    nombre: str
    correo: str
    password: str
    plan: str                          # Micro | Estándar | Corporativo
    num_empleados: int
    metodo_pago: str                   # Tarjeta | Yape | Transferencia
    tarjeta_ultimos4: Optional[str] = None

class PagoResponse(BaseModel):
    pago_id: int
    plan: str
    num_empleados: int
    monto: float
    metodo_pago: str
    referencia: str
    estado: str

    class Config:
        from_attributes = True

# --- Esquemas para Usuarios ---

class UsuarioCreate(BaseModel):
    nombre: str
    correo: str
    password: str
    rol: str  # Admin | RRHH | Gerente | Empleado

class UsuarioResponse(BaseModel):
    usuario_id: int
    nombre: str
    correo: str
    rol: str
    estado: str

    class Config:
        from_attributes = True

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
