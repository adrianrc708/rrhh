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


class EntradaHistorial(BaseModel):
    fecha: datetime
    usuario: str
    estado_anterior: str
    estado_nuevo: str
    comentarios: Optional[str] = None
