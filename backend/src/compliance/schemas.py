from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ArchivoExport(BaseModel):
    filename: str
    contenido: str
    mimetype: str = "text/plain"
    filas: int = 0


# ---- Legajo digital --------------------------------------------------------

class LegajoCreate(BaseModel):
    empleado_id: int
    categoria: str = "Otro"
    nombre: str
    datos: str            # data URL base64


class LegajoResponse(BaseModel):
    documento_id: int
    empleado_id: int
    categoria: str
    nombre: str
    datos: Optional[str] = None       # se omite en listados; presente al descargar
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---- Certificados digitales ------------------------------------------------

class CertificadoCreate(BaseModel):
    nombre: str
    titular: Optional[str] = None
    huella: Optional[str] = None
    datos: Optional[str] = None


class CertificadoResponse(BaseModel):
    certificado_id: int
    nombre: str
    titular: Optional[str] = None
    huella: Optional[str] = None
    activo: bool
    fecha_carga: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---- Firma de boletas ------------------------------------------------------

class FirmarBoletaRequest(BaseModel):
    password: str          # reconfirmación de credencial (PIN/token del usuario)


class FirmaResponse(BaseModel):
    firma_id: int
    detalle_id: int
    firmante: str
    hash_firma: Optional[str] = None
    fecha_firma: Optional[datetime] = None

    class Config:
        from_attributes = True
