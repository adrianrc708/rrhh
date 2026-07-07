from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel


# ---- Facturación (Admin) ---------------------------------------------------

class PagoItem(BaseModel):
    pago_id: int
    plan: str
    num_empleados: int
    monto: float
    metodo_pago: str
    referencia: str
    estado: str
    fecha_pago: Optional[datetime] = None


class FacturacionResponse(BaseModel):
    razon_social: str
    ruc: str
    plan: str
    estado: str
    total_pagado: float
    pagos: List[PagoItem]


class PagarRequest(BaseModel):
    num_empleados: int
    metodo_pago: str                 # Tarjeta | Yape | Transferencia
    tarjeta_ultimos4: Optional[str] = None


# ---- Roles personalizados (Admin) ------------------------------------------

class PermisosUsuarioResponse(BaseModel):
    usuario_id: int
    nombre: str
    correo: str
    rol: str
    secciones: List[str]         # secciones efectivas
    personalizado: bool          # True si hay override en BD


class SetPermisosRequest(BaseModel):
    # Lista de section keys; vacío o null => quitar el override (volver al rol).
    secciones: Optional[List[str]] = None


# ---- Datos maestros del empleado -------------------------------------------

class MisDatosResponse(BaseModel):
    empleado_id: int
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    direccion: Optional[str] = None
    banco: Optional[str] = None
    cuenta_bancaria: Optional[str] = None
    cci: Optional[str] = None
    cuspp: Optional[str] = None


class DerechohabienteItem(BaseModel):
    derechohabiente_id: int
    nombre: str
    parentesco: str
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    estado: str

    class Config:
        from_attributes = True


class SolicitudCambioCreate(BaseModel):
    tipo_cambio: str                 # Bancario | Domicilio | Derechohabiente
    # Payload libre según tipo:
    #  Bancario     -> {banco, cuenta_bancaria, cci}
    #  Domicilio    -> {direccion}
    #  Derechohabiente -> {accion: "alta"|"baja", nombre, parentesco, numero_documento, fecha_nacimiento, derechohabiente_id?}
    payload: dict


class SolicitudCambioResponse(BaseModel):
    solicitud_id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    tipo_cambio: str
    payload: dict
    estado: str
    comentario: Optional[str] = None
    fecha_creacion: Optional[datetime] = None


class ResolverCambioRequest(BaseModel):
    aprobar: bool
    comentario: Optional[str] = None
