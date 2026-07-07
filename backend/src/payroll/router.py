from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from src.database import get_db
from src.core.models import Usuario, Nomina, DetalleNomina, HistorialAprobacion, AlertaNormativa, HorasPeriodo
from src.core.dependencies import obtener_usuario_actual, verificar_rol, verificar_empleado_en_alcance
from src.core.services import registrar_auditoria
from src.hr.models import Empleado
from src.payroll.schemas import (
    NominaCreate, NominaResponse, CambiarEstadoRequest,
    BoletaEmpleado, ResumenConsolidacion, EntradaHistorial,
    HorasPeriodoItem, HorasPeriodoUpsert, AlertaNormativaResponse,
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
        perfil_contrato=detalle.perfil_contrato,
        pago_horas_extra_25=detalle.pago_horas_extra_25,
        pago_horas_extra_35=detalle.pago_horas_extra_35,
        pago_horas_nocturnas=detalle.pago_horas_nocturnas,
        bonos_sector=detalle.bonos_sector,
        descuento_inasistencias=detalle.descuento_inasistencias,
        total_ingresos_brutos=detalle.total_ingresos_brutos,
        tipo_pension=detalle.tipo_pension,
        aporte_pension=detalle.aporte_pension,
        impuesto_renta_5ta=detalle.impuesto_renta_5ta,
        descuento_prestamos=detalle.descuento_prestamos,
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


# ── Fase 2: Auditoría normativa ───────────────────────────────────────────────

@router.get("/{nomina_id}/auditoria", response_model=List[AlertaNormativaResponse])
def auditoria_nomina(
    nomina_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    """Hallazgos de la auditoría normativa (bloqueos y advertencias) de la nómina."""
    _get_nomina_empresa(nomina_id, usuario_actual.empresa_id, db)
    return (
        db.query(AlertaNormativa)
        .filter(AlertaNormativa.nomina_id == nomina_id)
        .order_by(AlertaNormativa.nivel.asc(), AlertaNormativa.id.asc())
        .all()
    )


# ── Fase 2: Captura manual de horas de segmentación ───────────────────────────

@router.get("/{nomina_id}/horas", response_model=List[HorasPeriodoItem])
def listar_horas_periodo(
    nomina_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    """
    Lista los empleados activos con sus horas de sobretiempo/nocturnas para el
    periodo de la nómina (para editarlas antes de consolidar). El Gerente solo
    ve su propio alcance jerárquico (no puede editar, solo aprobar).
    """
    nomina = _get_nomina_empresa(nomina_id, usuario_actual.empresa_id, db)
    query = db.query(Empleado).filter(
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.estado == "Activo",
        Empleado.is_deleted.is_(False),
    )
    if usuario_actual.rol == "Gerente":
        from src.core.dependencies import alcance_empleados
        alcance = alcance_empleados(db, usuario_actual)
        query = query.filter(Empleado.empleado_id.in_(alcance or {-1}))
    empleados = query.all()

    registros = {
        h.empleado_id: h
        for h in db.query(HorasPeriodo).filter(
            HorasPeriodo.periodo == nomina.periodo,
            HorasPeriodo.is_deleted.is_(False),
        ).all()
    }

    salida: List[HorasPeriodoItem] = []
    for emp in empleados:
        h = registros.get(emp.empleado_id)
        salida.append(HorasPeriodoItem(
            empleado_id=emp.empleado_id,
            nombre=emp.nombre or f"Empleado {emp.empleado_id}",
            horas_extra_25=h.horas_extra_25 if h else 0,
            horas_extra_35=h.horas_extra_35 if h else 0,
            horas_nocturnas=h.horas_nocturnas if h else 0,
            estado=h.estado if h else "Pendiente",
        ))
    return salida


@router.post("/{nomina_id}/horas", status_code=status.HTTP_200_OK)
def guardar_horas_periodo(
    nomina_id: int,
    datos: HorasPeriodoUpsert,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    """
    Crea o actualiza (upsert) las horas de un empleado para el periodo de la
    nómina. Fase 5: toda edición vuelve el registro a "Pendiente" — el Gerente
    debe volver a aprobarlas antes de que la consolidación las valorice.
    """
    nomina = _get_nomina_empresa(nomina_id, usuario_actual.empresa_id, db)
    verificar_nomina_editable(nomina)  # no editar horas si la nómina está bloqueada

    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == datos.empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado en tu empresa")

    registro = db.query(HorasPeriodo).filter(
        HorasPeriodo.empleado_id == datos.empleado_id,
        HorasPeriodo.periodo == nomina.periodo,
        HorasPeriodo.is_deleted.is_(False),
    ).first()

    if registro is None:
        registro = HorasPeriodo(
            empresa_id=usuario_actual.empresa_id,
            empleado_id=datos.empleado_id,
            periodo=nomina.periodo,
            registrado_por=usuario_actual.usuario_id,
        )
        db.add(registro)

    registro.horas_extra_25 = datos.horas_extra_25
    registro.horas_extra_35 = datos.horas_extra_35
    registro.horas_nocturnas = datos.horas_nocturnas
    registro.registrado_por = usuario_actual.usuario_id
    registro.estado = "Pendiente"
    registro.aprobado_por = None
    registro.fecha_aprobacion = None
    db.commit()


@router.patch("/{nomina_id}/horas/{empleado_id}/aprobar", status_code=status.HTTP_200_OK)
def aprobar_horas_periodo(
    nomina_id: int,
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    """Aprobación previa (Fase 5): sin esto, la consolidación no valoriza el sobretiempo del empleado."""
    from sqlalchemy import func as sa_func
    nomina = _get_nomina_empresa(nomina_id, usuario_actual.empresa_id, db)
    verificar_nomina_editable(nomina)
    verificar_empleado_en_alcance(db, usuario_actual, empleado_id)

    registro = db.query(HorasPeriodo).filter(
        HorasPeriodo.empleado_id == empleado_id,
        HorasPeriodo.periodo == nomina.periodo,
        HorasPeriodo.is_deleted.is_(False),
    ).first()
    if not registro:
        raise HTTPException(status_code=404, detail="No hay horas registradas para este empleado en el periodo")
    if registro.estado == "Aprobado":
        raise HTTPException(status_code=400, detail="Estas horas ya fueron aprobadas")

    registro.estado = "Aprobado"
    registro.aprobado_por = usuario_actual.usuario_id
    registro.fecha_aprobacion = sa_func.now()
    db.commit()
    registrar_auditoria(db, usuario_actual.usuario_id, "APROBAR_HORAS_EXTRA", "Nómina",
                        {"nomina_id": nomina_id, "empleado_id": empleado_id, "periodo": nomina.periodo})
    return {"status": "ok", "empleado_id": empleado_id, "estado": "Aprobado"}
    return {"status": "ok", "empleado_id": datos.empleado_id, "periodo": nomina.periodo}
