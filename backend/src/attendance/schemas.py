from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from typing import Optional
from decimal import Decimal
from src.attendance.models import TIPOS_INASISTENCIA, TIPOS_QUE_DESCUENTAN


class InasistenciaCreate(BaseModel):
    empleado_id: int
    fecha: date
    tipo: str = Field(description="Injustificada | Justificada | Permiso_sin_goce | Permiso_con_goce | Licencia")
    horas_ausentes: Decimal = Field(default=Decimal("8.0"), ge=0, le=24)
    observaciones: Optional[str] = None

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, v):
        if v not in TIPOS_INASISTENCIA:
            raise ValueError(f"Tipo inválido. Valores permitidos: {TIPOS_INASISTENCIA}")
        return v


class InasistenciaResponse(BaseModel):
    inasistencia_id: int
    empleado_id: int
    empresa_id: int
    fecha: date
    tipo: str
    horas_ausentes: Decimal
    periodo: str
    observaciones: Optional[str] = None
    registrado_por: Optional[int] = None
    fecha_registro: datetime
    descuenta_sueldo: bool

    class Config:
        from_attributes = True
