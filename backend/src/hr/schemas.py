from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List
from decimal import Decimal

# ==========================================
# RF-04: DEPARTAMENTOS Y CARGOS
# ==========================================
class DepartamentoBase(BaseModel):
    nombre: str

class DepartamentoCreate(DepartamentoBase):
    pass

class DepartamentoResponse(DepartamentoBase):
    departamento_id: int
    empresa_id: int

    class Config:
        from_attributes = True

class CargoBase(BaseModel):
    nombre: str
    departamento_id: int
    parent_id: Optional[int] = None  # <-- MOVIDO AQUÍ: Jerarquía de puestos

class CargoCreate(CargoBase):
    pass

class CargoResponse(CargoBase):
    cargo_id: int

    class Config:
        from_attributes = True

# ==========================================
# RF-05: DIRECTORIO DE EMPLEADOS
# ==========================================
class EmpleadoBase(BaseModel):
    usuario_id: int
    nombre: Optional[str] = None
    departamento_id: Optional[int] = None
    cargo_id: Optional[int] = None
    jefe_id: Optional[int] = None  # Fase 1: línea de mando (aislamiento jerárquico)
    tipo_pension: str = Field(default="ONP", description="AFP o ONP")
    porcentaje_afp: Optional[Decimal] = Field(None, ge=0, le=1)
    fecha_ingreso: Optional[date] = None

class EmpleadoCreate(EmpleadoBase):
    pass

class EmpleadoUpdate(BaseModel):
    departamento_id: Optional[int] = None
    nombre: Optional[str] = None
    cargo_id: Optional[int] = None
    jefe_id: Optional[int] = None
    tipo_pension: Optional[str] = None
    porcentaje_afp: Optional[Decimal] = Field(None, ge=0, le=1)
    fecha_ingreso: Optional[date] = None
    estado: Optional[str] = None

class EmpleadoResponse(EmpleadoBase):
    empleado_id: int
    empresa_id: int
    estado: str
    fecha_creacion: datetime

    class Config:
        from_attributes = True

# ==========================================
# RF-06: HISTORIAL DE CONTRATOS
# ==========================================
class ContratoBase(BaseModel):
    empleado_id: int
    tipo_contrato: str
    perfil_contrato: str = Field(default="Comun", description="Comun | Minero | Agrario | Construccion | PartTime")
    sueldo_base: Decimal = Field(gt=0)
    horas_contrato_mes: Decimal = Field(default=Decimal("160"), ge=1)
    fecha_inicio: date
    fecha_fin: Optional[date] = None

class ContratoCreate(ContratoBase):
    pass

class ContratoResponse(ContratoBase):
    contrato_id: int
    estado: str
    fecha_creacion: datetime

    class Config:
        from_attributes = True