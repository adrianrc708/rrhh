from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from decimal import Decimal


class NominaCreate(BaseModel):
    periodo: str = Field(description="Formato YYYY-MM, ej: 2024-01")


class NominaResponse(BaseModel):
    id: int
    empresa_id: int
    periodo: str
    estado: str
    total_ingresos: Decimal
    total_descuentos: Decimal
    total_neto: Decimal
    fecha_creacion: datetime
    fecha_aprobacion: Optional[datetime] = None
    aprobado_por: Optional[int] = None

    class Config:
        from_attributes = True


class CambiarEstadoRequest(BaseModel):
    nuevo_estado: str = Field(description="Revision | Aprobado | Pagado | Borrador")
    comentarios: Optional[str] = None


class BoletaEmpleado(BaseModel):
    detalle_id: int
    nomina_id: int
    empleado_id: Optional[int] = None
    usuario_id: int
    nombre_empleado: str
    cargo: Optional[str] = None
    departamento: Optional[str] = None
    periodo: str
    # Horas
    horas_contrato_mes: Optional[Decimal] = None
    horas_trabajadas: Optional[Decimal] = None
    horas_ausentes: Optional[Decimal] = None
    # Ingresos
    sueldo_base: Decimal
    haberes: Decimal
    # Fase 2: segmentación horaria y bono sectorial
    perfil_contrato: Optional[str] = None
    pago_horas_extra_25: Optional[Decimal] = None
    pago_horas_extra_35: Optional[Decimal] = None
    pago_horas_nocturnas: Optional[Decimal] = None
    bonos_sector: Optional[Decimal] = None
    descuento_inasistencias: Optional[Decimal] = None
    total_ingresos_brutos: Optional[Decimal] = None
    # Descuentos legales
    tipo_pension: Optional[str] = None
    aporte_pension: Optional[Decimal] = None
    impuesto_renta_5ta: Optional[Decimal] = None
    # Totales
    total_descuentos: Decimal
    sueldo_neto: Decimal
    # Aporte empleador (informativo)
    aporte_empleador_essalud: Optional[Decimal] = None

    class Config:
        from_attributes = True


class ResumenConsolidacion(BaseModel):
    nomina_id: int
    periodo: str
    empleados_procesados: int
    total_ingresos: Decimal
    total_descuentos: Decimal
    total_neto: Decimal
    total_essalud_empleador: Decimal
    # Fase 2: resultado de la auditoría normativa
    alertas_normativas: int = 0
    bloqueos_normativos: int = 0


class EntradaHistorial(BaseModel):
    fecha: datetime
    usuario: str
    estado_anterior: str
    estado_nuevo: str
    comentarios: Optional[str] = None


# ── Fase 2: Segmentación horaria (captura manual) y auditoría normativa ─────────

class HorasPeriodoItem(BaseModel):
    """Fila editable de horas de un empleado para el periodo de la nómina."""
    empleado_id: int
    nombre: str
    horas_extra_25: Decimal = Decimal("0")
    horas_extra_35: Decimal = Decimal("0")
    horas_nocturnas: Decimal = Decimal("0")


class HorasPeriodoUpsert(BaseModel):
    empleado_id: int
    horas_extra_25: Decimal = Field(default=Decimal("0"), ge=0)
    horas_extra_35: Decimal = Field(default=Decimal("0"), ge=0)
    horas_nocturnas: Decimal = Field(default=Decimal("0"), ge=0)


class AlertaNormativaResponse(BaseModel):
    id: int
    empleado_id: Optional[int] = None
    nivel: str
    concepto: str
    mensaje: str
    explicacion: Optional[str] = None

    class Config:
        from_attributes = True
