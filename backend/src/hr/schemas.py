from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional
from decimal import Decimal


class EmpleadoBase(BaseModel):
    usuario_id: int
    sueldo_base: Decimal = Field(gt=0, description="Sueldo base mensual en soles")
    horas_contrato_mes: Decimal = Field(default=Decimal("160"), ge=1, description="Horas de contrato por mes (160 = tiempo completo)")
    tipo_pension: str = Field(default="ONP", description="AFP o ONP")
    porcentaje_afp: Optional[Decimal] = Field(None, ge=0, le=1, description="Tasa total AFP en decimal, ej: 0.1243")
    cargo: Optional[str] = None
    departamento: Optional[str] = None
    fecha_ingreso: Optional[date] = None


class EmpleadoCreate(EmpleadoBase):
    pass


class EmpleadoUpdate(BaseModel):
    sueldo_base: Optional[Decimal] = Field(None, gt=0)
    horas_contrato_mes: Optional[Decimal] = Field(None, ge=1)
    tipo_pension: Optional[str] = None
    porcentaje_afp: Optional[Decimal] = Field(None, ge=0, le=1)
    cargo: Optional[str] = None
    departamento: Optional[str] = None
    fecha_ingreso: Optional[date] = None
    estado: Optional[str] = None


class EmpleadoResponse(EmpleadoBase):
    empleado_id: int
    empresa_id: int
    estado: str
    fecha_creacion: datetime

    class Config:
        from_attributes = True
