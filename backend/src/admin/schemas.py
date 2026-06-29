from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class UsuarioAdminResponse(BaseModel):
    usuario_id: int
    nombre: str
    correo: str
    rol: str
    estado: str

    class Config:
        from_attributes = True

class EmpresaAdminResponse(BaseModel):
    empresa_id: int
    razon_social: str
    ruc: str
    plan_suscripcion: str
    fecha_registro: Optional[datetime] = None
    usuarios: List[UsuarioAdminResponse] = []

    class Config:
        from_attributes = True
