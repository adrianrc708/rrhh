from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel


# ---- Autogestión (solicitudes del empleado) --------------------------------

class SolicitudCreate(BaseModel):
    tipo: str                         # Vacaciones | Permiso | Licencia_medica
    fecha_inicio: date
    fecha_fin: date
    con_goce: bool = True
    motivo: Optional[str] = None
    documento_nombre: Optional[str] = None
    documento_datos: Optional[str] = None   # base64 (opcional)


class SolicitudResolver(BaseModel):
    aprobar: bool
    comentario: Optional[str] = None


class SolicitudResponse(BaseModel):
    solicitud_id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    tipo: str
    fecha_inicio: date
    fecha_fin: date
    dias: int
    con_goce: bool
    motivo: Optional[str] = None
    documento_nombre: Optional[str] = None
    estado: str
    comentario_resolucion: Optional[str] = None
    fecha_resolucion: Optional[datetime] = None
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True


class SaldoVacacionesResponse(BaseModel):
    empleado_id: int
    dias_ganados: int
    dias_gozados: int
    dias_disponibles: int


# ---- Beneficios sociales ---------------------------------------------------

class GratificacionRequest(BaseModel):
    empleado_id: Optional[int] = None   # None => toda la empresa (según alcance)
    semestre: str                        # Julio | Diciembre
    anio: int


class CtsRequest(BaseModel):
    empleado_id: Optional[int] = None
    periodo_cts: str                     # Mayo | Noviembre
    anio: int


class LiquidacionRequest(BaseModel):
    empleado_id: int
    fecha_cese: date
    dias_vacaciones_pendientes: int = 0


class BeneficioResponse(BaseModel):
    beneficio_id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    tipo: str
    periodo: str
    meses_computables: Optional[Decimal] = None
    remuneracion_computable: Optional[Decimal] = None
    monto: Decimal
    detalle: Optional[dict] = None
    estado: str
    fecha_calculo: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---- Evaluación de desempeño / kardex --------------------------------------

class EvaluacionCreate(BaseModel):
    empleado_id: int
    tipo: str = "Evaluacion"             # Evaluacion | Kardex_positivo | Kardex_disciplinario
    periodo: Optional[str] = None
    puntaje: Optional[int] = None        # 1..5
    comentario: str


class EvaluacionResponse(BaseModel):
    evaluacion_id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    tipo: str
    periodo: Optional[str] = None
    puntaje: Optional[int] = None
    comentario: str
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---- Validación de sobretiempo (Gerente) -----------------------------------

class SobretiempoResolver(BaseModel):
    aprobar: bool


class SobretiempoResponse(BaseModel):
    id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    periodo: str
    horas_extra_25: Decimal
    horas_extra_35: Decimal
    horas_nocturnas: Decimal
    estado_aprobacion: Optional[str] = None

    class Config:
        from_attributes = True
