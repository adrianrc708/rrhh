from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, date
from decimal import Decimal

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
    estado: str
    regimen_laboral: str = "General"
    fecha_registro: Optional[datetime] = None
    usuarios: List[UsuarioAdminResponse] = []

    class Config:
        from_attributes = True

class AdminStatsResponse(BaseModel):
    total_empresas: int
    total_usuarios: int
    empresas_por_plan: Dict[str, int]
    empresas_activas: int
    total_superadmins: int

class EmpresaCreate(BaseModel):
    razon_social: str
    ruc: str
    plan_suscripcion: str = "Micro"
    estado: str = "Activa"
    regimen_laboral: str = "General"

class EmpresaUpdate(BaseModel):
    razon_social: Optional[str] = None
    ruc: Optional[str] = None
    plan_suscripcion: Optional[str] = None
    estado: Optional[str] = None
    regimen_laboral: Optional[str] = None

class UsuarioSuperAdminCreate(BaseModel):
    nombre: str
    correo: str
    password: str
    rol: str


# ==========================================
# Fase 1: Parámetros fiscales versionados
# ==========================================
class ParametroFiscalCreate(BaseModel):
    clave: str
    valor: Decimal
    vigencia_desde: date
    descripcion: Optional[str] = None

class ParametroFiscalResponse(BaseModel):
    id: int
    clave: str
    valor: Decimal
    descripcion: Optional[str] = None
    vigencia_desde: date
    vigencia_hasta: Optional[date] = None
    activo: bool
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True

class ParametroFiscalVigenteResponse(BaseModel):
    """Valor actualmente vigente de una clave, para el resumen del panel."""
    clave: str
    valor: Decimal
    descripcion: Optional[str] = None
