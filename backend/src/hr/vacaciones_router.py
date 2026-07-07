from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import obtener_usuario_actual, obtener_empleado_actual, verificar_rol, alcance_empleados
from src.core.services import registrar_auditoria
from src.hr.models import Empleado
from src.hr.vacaciones_models import SolicitudVacaciones
from src.hr.vacaciones_calculo import dias_devengados

router = APIRouter()

MINIMO_FRACCIONAMIENTO = 7   # días naturales continuos mínimos por solicitud


# ── Schemas inline (mismo patrón que turno_router.py) ──

class SolicitudCreate(BaseModel):
    fecha_inicio: date
    fecha_fin: date


class SolicitudResponse(BaseModel):
    solicitud_id: int
    empleado_id: int
    nombre_empleado: Optional[str] = None
    fecha_inicio: date
    fecha_fin: date
    dias_solicitados: int
    estado: str
    motivo_rechazo: Optional[str] = None
    fecha_solicitud: datetime

    class Config:
        from_attributes = True


class SaldoResponse(BaseModel):
    empleado_id: int
    nombre: Optional[str] = None
    fecha_ingreso: Optional[date] = None
    dias_devengados: int
    dias_comprometidos: int
    dias_disponibles: int


class RechazoRequest(BaseModel):
    motivo: Optional[str] = None


def _calcular_saldo(db: Session, empleado: Empleado) -> SaldoResponse:
    devengados = dias_devengados(empleado.fecha_ingreso, date.today())
    comprometidos = db.query(func.coalesce(func.sum(SolicitudVacaciones.dias_solicitados), 0)).filter(
        SolicitudVacaciones.empleado_id == empleado.empleado_id,
        SolicitudVacaciones.estado.in_(["Pendiente", "Aprobada"]),
        SolicitudVacaciones.is_deleted.is_(False),
    ).scalar()
    comprometidos = int(comprometidos or 0)
    return SaldoResponse(
        empleado_id=empleado.empleado_id,
        nombre=empleado.nombre,
        fecha_ingreso=empleado.fecha_ingreso,
        dias_devengados=devengados,
        dias_comprometidos=comprometidos,
        dias_disponibles=max(0, devengados - comprometidos),
    )


def _a_response(sol: SolicitudVacaciones, nombre: Optional[str] = None) -> SolicitudResponse:
    return SolicitudResponse(
        solicitud_id=sol.solicitud_id,
        empleado_id=sol.empleado_id,
        nombre_empleado=nombre,
        fecha_inicio=sol.fecha_inicio,
        fecha_fin=sol.fecha_fin,
        dias_solicitados=sol.dias_solicitados,
        estado=sol.estado,
        motivo_rechazo=sol.motivo_rechazo,
        fecha_solicitud=sol.fecha_solicitud,
    )


def _empleado_en_alcance(db: Session, usuario: Usuario, empleado_id: int) -> Empleado:
    """Verifica que el empleado exista, sea de la empresa, y esté dentro del alcance del usuario."""
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == empleado_id,
        Empleado.empresa_id == usuario.empresa_id,
        Empleado.is_deleted.is_(False),
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado en tu empresa")
    alcance = alcance_empleados(db, usuario)
    if alcance is not None and empleado_id not in alcance:
        raise HTTPException(status_code=403, detail="No tienes autorización sobre este colaborador")
    return empleado


# ==========================================================================
# Autogestión (Empleado)
# ==========================================================================

@router.get("/mi-saldo", response_model=SaldoResponse)
def mi_saldo(
    empleado: Empleado = Depends(obtener_empleado_actual),
    db: Session = Depends(get_db),
):
    return _calcular_saldo(db, empleado)


@router.get("/mis-solicitudes", response_model=List[SolicitudResponse])
def mis_solicitudes(
    empleado: Empleado = Depends(obtener_empleado_actual),
    db: Session = Depends(get_db),
):
    solicitudes = db.query(SolicitudVacaciones).filter(
        SolicitudVacaciones.empleado_id == empleado.empleado_id,
        SolicitudVacaciones.is_deleted.is_(False),
    ).order_by(SolicitudVacaciones.fecha_solicitud.desc()).all()
    return [_a_response(s, empleado.nombre) for s in solicitudes]


@router.post("/solicitar", response_model=SolicitudResponse, status_code=status.HTTP_201_CREATED)
def solicitar_vacaciones(
    datos: SolicitudCreate,
    empleado: Empleado = Depends(obtener_empleado_actual),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    if datos.fecha_inicio < date.today():
        raise HTTPException(status_code=400, detail="La fecha de inicio no puede ser anterior a hoy.")
    if datos.fecha_fin < datos.fecha_inicio:
        raise HTTPException(status_code=400, detail="La fecha de fin debe ser posterior a la fecha de inicio.")

    dias = (datos.fecha_fin - datos.fecha_inicio).days + 1
    if dias < MINIMO_FRACCIONAMIENTO:
        raise HTTPException(
            status_code=400,
            detail=f"El descanso vacacional debe fraccionarse en periodos mínimos de {MINIMO_FRACCIONAMIENTO} días continuos.",
        )

    saldo = _calcular_saldo(db, empleado)
    if dias > saldo.dias_disponibles:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente: dispones de {saldo.dias_disponibles} día(s) y solicitaste {dias}.",
        )

    solicitud = SolicitudVacaciones(
        empresa_id=usuario_actual.empresa_id,
        empleado_id=empleado.empleado_id,
        fecha_inicio=datos.fecha_inicio,
        fecha_fin=datos.fecha_fin,
        dias_solicitados=dias,
        estado="Pendiente",
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)
    registrar_auditoria(db, usuario_actual.usuario_id, "SOLICITAR_VACACIONES", "Vacaciones",
                        {"solicitud_id": solicitud.solicitud_id, "dias": dias})
    return _a_response(solicitud, empleado.nombre)


@router.post("/solicitudes/{solicitud_id}/cancelar", response_model=SolicitudResponse)
def cancelar_solicitud(
    solicitud_id: int,
    empleado: Empleado = Depends(obtener_empleado_actual),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    """El propio empleado retira una solicitud mientras siga Pendiente."""
    solicitud = db.query(SolicitudVacaciones).filter(
        SolicitudVacaciones.solicitud_id == solicitud_id,
        SolicitudVacaciones.empleado_id == empleado.empleado_id,
        SolicitudVacaciones.is_deleted.is_(False),
    ).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if solicitud.estado != "Pendiente":
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar solicitudes pendientes")

    solicitud.estado = "Cancelada"
    solicitud.fecha_resolucion = func.now()
    db.commit()
    db.refresh(solicitud)
    registrar_auditoria(db, usuario_actual.usuario_id, "CANCELAR_VACACIONES", "Vacaciones",
                        {"solicitud_id": solicitud_id})
    return _a_response(solicitud, empleado.nombre)


# ==========================================================================
# Supervisión (Admin / RRHH / Gerente — acotado a su alcance jerárquico)
# ==========================================================================

@router.get("/saldo/{empleado_id}", response_model=SaldoResponse)
def saldo_de_empleado(
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    empleado = _empleado_en_alcance(db, usuario_actual, empleado_id)
    return _calcular_saldo(db, empleado)


@router.get("/equipo", response_model=List[SaldoResponse])
def saldo_del_equipo(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    """Vista general del saldo vacacional de todos los colaboradores dentro del alcance del usuario."""
    alcance = alcance_empleados(db, usuario_actual)
    query = db.query(Empleado).filter(
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.estado == "Activo",
        Empleado.is_deleted.is_(False),
    )
    if alcance is not None:
        if not alcance:
            return []
        query = query.filter(Empleado.empleado_id.in_(alcance))
    return [_calcular_saldo(db, e) for e in query.all()]


@router.get("/pendientes", response_model=List[SolicitudResponse])
def solicitudes_pendientes(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    alcance = alcance_empleados(db, usuario_actual)
    query = (
        db.query(SolicitudVacaciones, Empleado.nombre)
        .join(Empleado, Empleado.empleado_id == SolicitudVacaciones.empleado_id)
        .filter(
            SolicitudVacaciones.empresa_id == usuario_actual.empresa_id,
            SolicitudVacaciones.estado == "Pendiente",
            SolicitudVacaciones.is_deleted.is_(False),
        )
    )
    if alcance is not None:
        if not alcance:
            return []
        query = query.filter(SolicitudVacaciones.empleado_id.in_(alcance))
    resultados = query.order_by(SolicitudVacaciones.fecha_solicitud.asc()).all()
    return [_a_response(sol, nombre) for sol, nombre in resultados]


@router.patch("/solicitudes/{solicitud_id}/aprobar", response_model=SolicitudResponse)
def aprobar_solicitud(
    solicitud_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    solicitud = db.query(SolicitudVacaciones).filter(
        SolicitudVacaciones.solicitud_id == solicitud_id,
        SolicitudVacaciones.empresa_id == usuario_actual.empresa_id,
        SolicitudVacaciones.is_deleted.is_(False),
    ).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    empleado = _empleado_en_alcance(db, usuario_actual, solicitud.empleado_id)
    if solicitud.estado != "Pendiente":
        raise HTTPException(status_code=400, detail="La solicitud ya fue resuelta")

    solicitud.estado = "Aprobada"
    solicitud.resuelto_por = usuario_actual.usuario_id
    solicitud.fecha_resolucion = func.now()
    db.commit()
    db.refresh(solicitud)
    registrar_auditoria(db, usuario_actual.usuario_id, "APROBAR_VACACIONES", "Vacaciones",
                        {"solicitud_id": solicitud_id, "empleado_id": solicitud.empleado_id})
    return _a_response(solicitud, empleado.nombre)


@router.patch("/solicitudes/{solicitud_id}/rechazar", response_model=SolicitudResponse)
def rechazar_solicitud(
    solicitud_id: int,
    datos: RechazoRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    solicitud = db.query(SolicitudVacaciones).filter(
        SolicitudVacaciones.solicitud_id == solicitud_id,
        SolicitudVacaciones.empresa_id == usuario_actual.empresa_id,
        SolicitudVacaciones.is_deleted.is_(False),
    ).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    empleado = _empleado_en_alcance(db, usuario_actual, solicitud.empleado_id)
    if solicitud.estado != "Pendiente":
        raise HTTPException(status_code=400, detail="La solicitud ya fue resuelta")

    solicitud.estado = "Rechazada"
    solicitud.motivo_rechazo = datos.motivo
    solicitud.resuelto_por = usuario_actual.usuario_id
    solicitud.fecha_resolucion = func.now()
    db.commit()
    db.refresh(solicitud)
    registrar_auditoria(db, usuario_actual.usuario_id, "RECHAZAR_VACACIONES", "Vacaciones",
                        {"solicitud_id": solicitud_id, "empleado_id": solicitud.empleado_id})
    return _a_response(solicitud, empleado.nombre)
