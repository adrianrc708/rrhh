from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from src.database import get_db
from src.core.models import Usuario, Nomina, DetalleNomina, HistorialAprobacion
from src.core.dependencies import obtener_usuario_actual, verificar_rol
from src.core.services import registrar_auditoria
from src.hr.models import Empleado
from src.payroll.schemas import (
    NominaCreate, NominaResponse, CambiarEstadoRequest,
    BoletaEmpleado, ResumenConsolidacion, EntradaHistorial,
)
from src.payroll.services import cambiar_estado_nomina, consolidar_nomina, verificar_nomina_editable

router = APIRouter()


def _get_nomina_empresa(nomina_id: int, empresa_id: int, db: Session) -> Nomina:
    nomina = db.query(Nomina).filter(
        Nomina.id == nomina_id,
        Nomina.empresa_id == empresa_id,
    ).first()
    if not nomina:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    return nomina


def _construir_boleta(detalle: DetalleNomina, nomina: Nomina, db: Session) -> BoletaEmpleado:
    usuario = db.query(Usuario).filter(Usuario.usuario_id == detalle.usuario_id).first()
    empleado = db.query(Empleado).filter(Empleado.usuario_id == detalle.usuario_id).first()
    # El cargo y el departamento se resuelven por relación (no son atributos directos de Empleado)
    cargo_nombre = empleado.cargo_rel.nombre if empleado and empleado.cargo_rel else None
    departamento_nombre = empleado.departamento_rel.nombre if empleado and empleado.departamento_rel else None
    return BoletaEmpleado(
        detalle_id=detalle.id,
        nomina_id=detalle.nomina_id,
        empleado_id=empleado.empleado_id if empleado else None,
        usuario_id=detalle.usuario_id,
        nombre_empleado=(empleado.nombre if empleado and empleado.nombre else (usuario.nombre if usuario else "N/A")),
        cargo=cargo_nombre,
        departamento=departamento_nombre,
        periodo=nomina.periodo,
        horas_contrato_mes=detalle.horas_contrato_mes,
        horas_trabajadas=detalle.horas_trabajadas,
        horas_ausentes=detalle.horas_ausentes,
        sueldo_base=detalle.sueldo_base,
        haberes=detalle.haberes,
        descuento_inasistencias=detalle.descuento_inasistencias,
        total_ingresos_brutos=detalle.total_ingresos_brutos,
        tipo_pension=detalle.tipo_pension,
        aporte_pension=detalle.aporte_pension,
        impuesto_renta_5ta=detalle.impuesto_renta_5ta,
        total_descuentos=detalle.descuentos,
        sueldo_neto=detalle.sueldo_neto,
        aporte_empleador_essalud=detalle.aporte_empleador_essalud,
    )


# ── Gestión de nóminas ────────────────────────────────────────────────────────

@router.post("/", response_model=NominaResponse, status_code=status.HTTP_201_CREATED)
def crear_nomina(
    datos: NominaCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    if db.query(Nomina).filter(
        Nomina.empresa_id == usuario_actual.empresa_id,
        Nomina.periodo == datos.periodo,
    ).first():
        raise HTTPException(status_code=409, detail=f"Ya existe una nómina para el periodo {datos.periodo}")

    nomina = Nomina(empresa_id=usuario_actual.empresa_id, periodo=datos.periodo)
    db.add(nomina)
    db.commit()
    db.refresh(nomina)
    registrar_auditoria(db, usuario_actual.usuario_id, "CREAR_NOMINA", "Nómina",
                        {"nomina_id": nomina.id, "periodo": datos.periodo})
    return nomina


@router.get("/", response_model=List[NominaResponse])
def listar_nominas(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    return (
        db.query(Nomina)
        .filter(Nomina.empresa_id == usuario_actual.empresa_id)
        .order_by(Nomina.periodo.desc())
        .all()
    )


@router.get("/{nomina_id}", response_model=NominaResponse)
def obtener_nomina(
    nomina_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    return _get_nomina_empresa(nomina_id, usuario_actual.empresa_id, db)


# ── RF-11 + RF-12 + RF-17: Consolidación ─────────────────────────────────────

@router.post("/{nomina_id}/consolidar", response_model=ResumenConsolidacion)
def consolidar(
    nomina_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    """
    Calcula la planilla completa para todos los empleados activos.
    Lee inasistencias del periodo, aplica el motor de cálculo (ONP/AFP + IR 5ta)
    y persiste los detalles individuales y los totales de la nómina.
    Solo es posible en estado Borrador.
    """
    nomina = _get_nomina_empresa(nomina_id, usuario_actual.empresa_id, db)
    resultado = consolidar_nomina(db, nomina, usuario_actual.empresa_id)
    registrar_auditoria(db, usuario_actual.usuario_id, "CONSOLIDAR_NOMINA", "Nómina", resultado)
    return resultado


# ── RF-12: Boletas ────────────────────────────────────────────────────────────

@router.get("/{nomina_id}/boletas", response_model=List[BoletaEmpleado])
def listar_boletas(
    nomina_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    """Devuelve la boleta de pago de cada empleado para la nómina indicada."""
    nomina = _get_nomina_empresa(nomina_id, usuario_actual.empresa_id, db)
    detalles = db.query(DetalleNomina).filter(DetalleNomina.nomina_id == nomina_id).all()
    return [_construir_boleta(d, nomina, db) for d in detalles]


@router.get("/{nomina_id}/boletas/mi-boleta", response_model=BoletaEmpleado)
def mi_boleta(
    nomina_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """Permite a cualquier empleado consultar su propia boleta."""
    nomina = _get_nomina_empresa(nomina_id, usuario_actual.empresa_id, db)
    detalle = db.query(DetalleNomina).filter(
        DetalleNomina.nomina_id == nomina_id,
        DetalleNomina.usuario_id == usuario_actual.usuario_id,
    ).first()
    if not detalle:
        raise HTTPException(status_code=404, detail="No tienes boleta registrada en esta nómina")
    return _construir_boleta(detalle, nomina, db)


# ── RF-13: Flujo de estados ───────────────────────────────────────────────────

@router.patch("/{nomina_id}/estado", response_model=NominaResponse)
def cambiar_estado(
    nomina_id: int,
    datos: CambiarEstadoRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """
    Gestiona las transiciones de estado con control de roles y bloqueo de edición.
    Borrador → Revision (RRHH/Admin)
    Revision → Aprobado (Gerente/Admin) | → Borrador (Gerente/Admin)
    Aprobado → Pagado (Admin) | → Revision (Admin)
    Pagado → (bloqueado)
    """
    nomina = _get_nomina_empresa(nomina_id, usuario_actual.empresa_id, db)
    nomina_actualizada = cambiar_estado_nomina(
        db, nomina, datos.nuevo_estado, usuario_actual, datos.comentarios
    )
    registrar_auditoria(
        db, usuario_actual.usuario_id, "CAMBIO_ESTADO_NOMINA", "Nómina",
        {"nomina_id": nomina_id, "estado_nuevo": datos.nuevo_estado, "comentarios": datos.comentarios},
    )
    return nomina_actualizada


@router.get("/{nomina_id}/historial", response_model=List[EntradaHistorial])
def historial_aprobacion(
    nomina_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    """Devuelve el historial completo de cambios de estado de una nómina."""
    _get_nomina_empresa(nomina_id, usuario_actual.empresa_id, db)
    registros = (
        db.query(HistorialAprobacion)
        .filter(HistorialAprobacion.nomina_id == nomina_id)
        .order_by(HistorialAprobacion.fecha_cambio)
        .all()
    )
    resultado = []
    for h in registros:
        u = db.query(Usuario).filter(Usuario.usuario_id == h.usuario_id).first()
        resultado.append(EntradaHistorial(
            fecha=h.fecha_cambio,
            usuario=u.nombre if u else "N/A",
            estado_anterior=h.estado_anterior,
            estado_nuevo=h.estado_nuevo,
            comentarios=h.comentarios,
        ))
    return resultado
