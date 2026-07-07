from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from typing import Optional, List
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


# ============================================================================
# Fase 3 — Kiosco facial, marcaciones y conciliación
# ============================================================================

class DispositivoCreate(BaseModel):
    nombre: str
    pin: str = Field(min_length=4, max_length=12)

class DispositivoResponse(BaseModel):
    dispositivo_id: int
    nombre: str
    activo: bool
    ultimo_uso: Optional[datetime] = None
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True

class DispositivoCreado(DispositivoResponse):
    """Se devuelve UNA sola vez al crear: incluye el token en claro."""
    token: str

class KioscoVerificar(BaseModel):
    token: str
    pin: str

class RostroCreate(BaseModel):
    empleado_id: int
    descriptor: List[float]
    etiqueta: Optional[str] = None

class RostroResponse(BaseModel):
    id: int
    empleado_id: int
    etiqueta: Optional[str] = None
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True

class MarcarKiosco(BaseModel):
    descriptor: List[float]
    lat: Optional[float] = None
    lng: Optional[float] = None

class MarcarRemoto(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None

class MarcacionResponse(BaseModel):
    marcacion_id: int
    empleado_id: int
    tipo: str
    momento: datetime
    fecha: date
    origen: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    ip: Optional[str] = None

    class Config:
        from_attributes = True

class MarcacionKioscoResultado(BaseModel):
    empleado_id: int
    nombre: str
    tipo: str
    momento: datetime
    distancia: float

class CicloJornadaCreate(BaseModel):
    empleado_id: int
    nombre: str = "14x7"
    dias_trabajo: int = Field(gt=0)
    dias_descanso: int = Field(ge=0)
    fecha_inicio_ciclo: date

class CicloJornadaResponse(CicloJornadaCreate):
    ciclo_id: int
    activo: bool

    class Config:
        from_attributes = True

class ConciliacionItem(BaseModel):
    empleado_id: int
    nombre: str
    marcaciones: int
    dias_trabajados: int
    horas_totales: Decimal
    horas_extra_25: Decimal
    horas_extra_35: Decimal
    horas_nocturnas: Decimal
    jornada_ciclica: Optional[str] = None

class CierreResponse(BaseModel):
    periodo: str
    estado: str
    empleados_afectados: int
