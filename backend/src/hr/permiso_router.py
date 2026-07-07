import os
import shutil
import uuid
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import (
    obtener_usuario_actual, obtener_empleado_actual, verificar_rol,
    alcance_empleados, verificar_empleado_en_alcance,
)
from src.core.services import registrar_auditoria
from src.hr.models import Empleado
from src.hr.permiso_models import SolicitudPermiso
from src.attendance.models import Inasistencia

router = APIRouter()

TIPOS_AUTOGESTION = {"Justificada", "Permiso_sin_goce", "Permiso_con_goce", "Licencia"}
EXTENSIONES_PERMITIDAS = {".pdf", ".jpg", ".jpeg", ".png"}
TAMANO_MAXIMO_MB = 5
UPLOAD_DIR = "uploads/permisos"


# ── Schemas inline ──

class SolicitudPermisoResponse(BaseModel):
    solicitud_id: int
    empleado_id: int
    nombre_empleado: Optional[str] = None
    tipo: str
    fecha: date
    horas: float
    observaciones: Optional[str] = None
    documento_nombre: Optional[str] = None
    estado: str
    motivo_rechazo: Optional[str] = None
    fecha_solicitud: datetime

    class Config:
        from_attributes = True


class RechazoRequest(BaseModel):
    motivo: Optional[str] = None


def _a_response(s: SolicitudPermiso, nombre: Optional[str] = None) -> SolicitudPermisoResponse:
    return SolicitudPermisoResponse(
        solicitud_id=s.solicitud_id, empleado_id=s.empleado_id, nombre_empleado=nombre,
        tipo=s.tipo, fecha=s.fecha, horas=float(s.horas), observaciones=s.observaciones,
        documento_nombre=s.documento_nombre, estado=s.estado, motivo_rechazo=s.motivo_rechazo,
        fecha_solicitud=s.fecha_solicitud,
    )


def _guardar_documento(empleado_id: int, documento: UploadFile) -> tuple[str, str]:
    ext = os.path.splitext(documento.filename or "")[1].lower()
    if ext not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(status_code=400, detail=f"Formato no permitido. Usa: {', '.join(EXTENSIONES_PERMITIDAS)}")

    carpeta = os.path.join(UPLOAD_DIR, str(empleado_id))
    os.makedirs(carpeta, exist_ok=True)
    nombre_guardado = f"{uuid.uuid4().hex}{ext}"
    ruta = os.path.join(carpeta, nombre_guardado)

    tamano = 0
    with open(ruta, "wb") as destino:
        while chunk := documento.file.read(1024 * 1024):
            tamano += len(chunk)
            if tamano > TAMANO_MAXIMO_MB * 1024 * 1024:
                destino.close()
                os.remove(ruta)
                raise HTTPException(status_code=400, detail=f"El archivo supera el máximo de {TAMANO_MAXIMO_MB} MB.")
            destino.write(chunk)

    return ruta, documento.filename


# ==========================================================================
# Autogestión (Empleado)
# ==========================================================================

@router.post("/solicitar", response_model=SolicitudPermisoResponse, status_code=status.HTTP_201_CREATED)
def solicitar_permiso(
    tipo: str = Form(...),
    fecha: date = Form(...),
    horas: float = Form(8.0),
    observaciones: Optional[str] = Form(None),
    documento: Optional[UploadFile] = File(None),
    empleado: Empleado = Depends(obtener_empleado_actual),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    if tipo not in TIPOS_AUTOGESTION:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Opciones: {', '.join(TIPOS_AUTOGESTION)}")
    if horas <= 0 or horas > 24:
        raise HTTPException(status_code=400, detail="Las horas deben estar entre 0 y 24.")

    documento_path = documento_nombre = None
    if documento is not None and documento.filename:
        documento_path, documento_nombre = _guardar_documento(empleado.empleado_id, documento)

    solicitud = SolicitudPermiso(
        empresa_id=usuario_actual.empresa_id,
        empleado_id=empleado.empleado_id,
        tipo=tipo, fecha=fecha, horas=horas, observaciones=observaciones,
        documento_path=documento_path, documento_nombre=documento_nombre,
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)
    registrar_auditoria(db, usuario_actual.usuario_id, "SOLICITAR_PERMISO", "Asistencia",
                        {"solicitud_id": solicitud.solicitud_id, "tipo": tipo, "fecha": str(fecha)})
    return _a_response(solicitud, empleado.nombre)


@router.get("/mis-solicitudes", response_model=List[SolicitudPermisoResponse])
def mis_solicitudes(
    empleado: Empleado = Depends(obtener_empleado_actual),
    db: Session = Depends(get_db),
):
    solicitudes = db.query(SolicitudPermiso).filter(
        SolicitudPermiso.empleado_id == empleado.empleado_id,
        SolicitudPermiso.is_deleted.is_(False),
    ).order_by(SolicitudPermiso.fecha_solicitud.desc()).all()
    return [_a_response(s, empleado.nombre) for s in solicitudes]


@router.post("/solicitudes/{solicitud_id}/cancelar", response_model=SolicitudPermisoResponse)
def cancelar_solicitud(
    solicitud_id: int,
    empleado: Empleado = Depends(obtener_empleado_actual),
    db: Session = Depends(get_db),
):
    solicitud = db.query(SolicitudPermiso).filter(
        SolicitudPermiso.solicitud_id == solicitud_id,
        SolicitudPermiso.empleado_id == empleado.empleado_id,
        SolicitudPermiso.is_deleted.is_(False),
    ).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if solicitud.estado != "Pendiente":
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar solicitudes pendientes")

    solicitud.estado = "Cancelada"
    solicitud.fecha_resolucion = func.now()
    db.commit()
    db.refresh(solicitud)
    return _a_response(solicitud, empleado.nombre)


# ==========================================================================
# Supervisión (Admin / RRHH / Gerente — acotado a su alcance jerárquico)
# ==========================================================================

@router.get("/pendientes", response_model=List[SolicitudPermisoResponse])
def solicitudes_pendientes(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    alcance = alcance_empleados(db, usuario_actual)
    query = (
        db.query(SolicitudPermiso, Empleado.nombre)
        .join(Empleado, Empleado.empleado_id == SolicitudPermiso.empleado_id)
        .filter(
            SolicitudPermiso.empresa_id == usuario_actual.empresa_id,
            SolicitudPermiso.estado == "Pendiente",
            SolicitudPermiso.is_deleted.is_(False),
        )
    )
    if alcance is not None:
        if not alcance:
            return []
        query = query.filter(SolicitudPermiso.empleado_id.in_(alcance))
    resultados = query.order_by(SolicitudPermiso.fecha_solicitud.asc()).all()
    return [_a_response(s, nombre) for s, nombre in resultados]


@router.patch("/{solicitud_id}/aprobar", response_model=SolicitudPermisoResponse)
def aprobar_solicitud(
    solicitud_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    solicitud = db.query(SolicitudPermiso).filter(
        SolicitudPermiso.solicitud_id == solicitud_id,
        SolicitudPermiso.empresa_id == usuario_actual.empresa_id,
        SolicitudPermiso.is_deleted.is_(False),
    ).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    empleado = verificar_empleado_en_alcance(db, usuario_actual, solicitud.empleado_id)
    if solicitud.estado != "Pendiente":
        raise HTTPException(status_code=400, detail="La solicitud ya fue resuelta")

    # Se materializa como Inasistencia real para que la consolidación de planilla
    # la considere (RF-17: descuento automático según el tipo).
    inasistencia = Inasistencia(
        empleado_id=solicitud.empleado_id,
        empresa_id=solicitud.empresa_id,
        fecha=solicitud.fecha,
        tipo=solicitud.tipo,
        horas_ausentes=solicitud.horas,
        periodo=solicitud.fecha.strftime("%Y-%m"),
        observaciones=solicitud.observaciones,
        registrado_por=usuario_actual.usuario_id,
    )
    db.add(inasistencia)
    db.flush()

    solicitud.estado = "Aprobada"
    solicitud.inasistencia_id = inasistencia.inasistencia_id
    solicitud.resuelto_por = usuario_actual.usuario_id
    solicitud.fecha_resolucion = func.now()
    db.commit()
    db.refresh(solicitud)
    registrar_auditoria(db, usuario_actual.usuario_id, "APROBAR_PERMISO", "Asistencia",
                        {"solicitud_id": solicitud_id, "empleado_id": solicitud.empleado_id})
    return _a_response(solicitud, empleado.nombre)


@router.patch("/{solicitud_id}/rechazar", response_model=SolicitudPermisoResponse)
def rechazar_solicitud(
    solicitud_id: int,
    datos: RechazoRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    solicitud = db.query(SolicitudPermiso).filter(
        SolicitudPermiso.solicitud_id == solicitud_id,
        SolicitudPermiso.empresa_id == usuario_actual.empresa_id,
        SolicitudPermiso.is_deleted.is_(False),
    ).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    empleado = verificar_empleado_en_alcance(db, usuario_actual, solicitud.empleado_id)
    if solicitud.estado != "Pendiente":
        raise HTTPException(status_code=400, detail="La solicitud ya fue resuelta")

    solicitud.estado = "Rechazada"
    solicitud.motivo_rechazo = datos.motivo
    solicitud.resuelto_por = usuario_actual.usuario_id
    solicitud.fecha_resolucion = func.now()
    db.commit()
    db.refresh(solicitud)
    registrar_auditoria(db, usuario_actual.usuario_id, "RECHAZAR_PERMISO", "Asistencia",
                        {"solicitud_id": solicitud_id, "empleado_id": solicitud.empleado_id})
    return _a_response(solicitud, empleado.nombre)


@router.get("/{solicitud_id}/documento")
def descargar_documento(
    solicitud_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """Descarga el documento adjunto. Acceso: el propio empleado, su alcance jerárquico o Admin/RRHH."""
    solicitud = db.query(SolicitudPermiso).filter(
        SolicitudPermiso.solicitud_id == solicitud_id,
        SolicitudPermiso.empresa_id == usuario_actual.empresa_id,
        SolicitudPermiso.is_deleted.is_(False),
    ).first()
    if not solicitud or not solicitud.documento_path:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    empleado_propio = db.query(Empleado).filter(Empleado.usuario_id == usuario_actual.usuario_id).first()
    es_dueno = empleado_propio is not None and empleado_propio.empleado_id == solicitud.empleado_id
    if not es_dueno:
        verificar_empleado_en_alcance(db, usuario_actual, solicitud.empleado_id)

    if not os.path.isfile(solicitud.documento_path):
        raise HTTPException(status_code=404, detail="El archivo ya no está disponible en el servidor")
    return FileResponse(solicitud.documento_path, filename=solicitud.documento_nombre)
