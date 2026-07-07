"""
Fase 5 — Router de beneficios sociales y autogestión.

Superficies por rol:
  - Empleado : crea solicitudes (vacaciones/permiso/licencia) y ve su saldo.
  - Gerente  : aprueba/rechaza solicitudes y sobretiempo de su equipo; evalúa.
  - RRHH/Admin: calcula gratificaciones/CTS/liquidaciones y ve el consolidado.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from decimal import Decimal
from datetime import date, datetime
import json

from src.database import get_db
from src.core.models import Usuario, Empresa, HorasPeriodo
from src.core.dependencies import (
    obtener_usuario_actual, verificar_rol, obtener_empleado_actual,
    alcance_empleados, obtener_ids_subordinados,
)
from src.core.fiscal import cargar_parametros_fiscales
from src.core.services import crear_notificacion, registrar_auditoria
from src.hr.models import Empleado, Contrato
from src.benefits.models import (
    SolicitudAutogestion, BeneficioSocial, EvaluacionDesempeno,
    TIPOS_SOLICITUD, ESTADO_PENDIENTE, ESTADO_APROBADA, ESTADO_RECHAZADA,
)
from src.benefits.calculations import (
    calcular_gratificacion, calcular_cts, calcular_liquidacion, saldo_vacaciones,
)
from src.benefits.schemas import (
    SolicitudCreate, SolicitudResolver, SolicitudResponse, SaldoVacacionesResponse,
    GratificacionRequest, CtsRequest, LiquidacionRequest, BeneficioResponse,
    EvaluacionCreate, EvaluacionResponse, SobretiempoResolver, SobretiempoResponse,
)

router = APIRouter()


# ==========================================================================
# Helpers
# ==========================================================================

def _nombre(db: Session, empleado_id: int) -> str:
    emp = db.query(Empleado).filter(Empleado.empleado_id == empleado_id).first()
    if emp and emp.nombre:
        return emp.nombre
    if emp:
        u = db.query(Usuario).filter(Usuario.usuario_id == emp.usuario_id).first()
        if u:
            return u.nombre
    return f"Empleado #{empleado_id}"


def _sueldo_vigente(db: Session, empleado_id: int) -> Decimal:
    contrato = db.query(Contrato).filter(
        Contrato.empleado_id == empleado_id,
        Contrato.estado == "Vigente",
        Contrato.is_deleted.is_(False),
    ).order_by(desc(Contrato.fecha_inicio)).first()
    if not contrato:
        contrato = db.query(Contrato).filter(
            Contrato.empleado_id == empleado_id, Contrato.is_deleted.is_(False),
        ).order_by(desc(Contrato.fecha_inicio)).first()
    return Decimal(str(contrato.sueldo_base)) if contrato else Decimal("0")


def _empleados_en_alcance(db: Session, usuario: Usuario, empleado_id: Optional[int]) -> List[Empleado]:
    """Empleados de la empresa a los que el usuario puede aplicar un cálculo."""
    q = db.query(Empleado).filter(
        Empleado.empresa_id == usuario.empresa_id,
        Empleado.is_deleted.is_(False),
    )
    alcance = alcance_empleados(db, usuario)
    if alcance is not None:
        q = q.filter(Empleado.empleado_id.in_(alcance))
    if empleado_id is not None:
        q = q.filter(Empleado.empleado_id == empleado_id)
    return q.all()


def _regimen(db: Session, empresa_id: int) -> str:
    emp = db.query(Empresa).filter(Empresa.empresa_id == empresa_id).first()
    return emp.regimen_laboral if emp else "General"


def _to_response(db: Session, s: SolicitudAutogestion) -> SolicitudResponse:
    return SolicitudResponse(
        solicitud_id=s.solicitud_id, empleado_id=s.empleado_id,
        empleado_nombre=_nombre(db, s.empleado_id), tipo=s.tipo,
        fecha_inicio=s.fecha_inicio, fecha_fin=s.fecha_fin, dias=s.dias,
        con_goce=s.con_goce, motivo=s.motivo, documento_nombre=s.documento_nombre,
        estado=s.estado, comentario_resolucion=s.comentario_resolucion,
        fecha_resolucion=s.fecha_resolucion, fecha_creacion=s.fecha_creacion,
    )


# ==========================================================================
# Autogestión del empleado
# ==========================================================================

@router.post("/solicitudes", response_model=SolicitudResponse, status_code=status.HTTP_201_CREATED)
def crear_solicitud(
    datos: SolicitudCreate,
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    """El empleado crea una solicitud; se enruta a su jefe directo (Gerente)."""
    if datos.tipo not in TIPOS_SOLICITUD:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Opciones: {', '.join(TIPOS_SOLICITUD)}")
    if datos.fecha_fin < datos.fecha_inicio:
        raise HTTPException(status_code=400, detail="La fecha fin no puede ser anterior a la de inicio.")

    dias = (datos.fecha_fin - datos.fecha_inicio).days + 1

    solicitud = SolicitudAutogestion(
        empresa_id=empleado.empresa_id,
        empleado_id=empleado.empleado_id,
        tipo=datos.tipo,
        fecha_inicio=datos.fecha_inicio,
        fecha_fin=datos.fecha_fin,
        dias=dias,
        con_goce=datos.con_goce,
        motivo=datos.motivo,
        documento_nombre=datos.documento_nombre,
        documento_datos=datos.documento_datos,
        aprobador_id=empleado.jefe_id,
        estado=ESTADO_PENDIENTE,
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)

    # Notificar al Gerente (jefe) si existe; si no, a RRHH/Admin de la empresa.
    nombre = _nombre(db, empleado.empleado_id)
    titulo = f"Nueva solicitud de {datos.tipo.lower()}"
    mensaje = f"{nombre} solicitó {datos.tipo.lower()} del {datos.fecha_inicio} al {datos.fecha_fin} ({dias} día(s))."
    if empleado.jefe_id:
        jefe = db.query(Empleado).filter(Empleado.empleado_id == empleado.jefe_id).first()
        if jefe and jefe.usuario_id:
            crear_notificacion(db, empleado.empresa_id, titulo, mensaje, jefe.usuario_id)
    else:
        for admin in db.query(Usuario).filter(
            Usuario.empresa_id == empleado.empresa_id,
            Usuario.rol.in_(["Admin", "RRHH"]),
            Usuario.is_deleted.is_(False),
        ).all():
            crear_notificacion(db, empleado.empresa_id, titulo, mensaje, admin.usuario_id)

    return _to_response(db, solicitud)


@router.get("/solicitudes/mias", response_model=List[SolicitudResponse])
def mis_solicitudes(
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    filas = db.query(SolicitudAutogestion).filter(
        SolicitudAutogestion.empleado_id == empleado.empleado_id,
        SolicitudAutogestion.is_deleted.is_(False),
    ).order_by(desc(SolicitudAutogestion.fecha_creacion)).all()
    return [_to_response(db, s) for s in filas]


@router.get("/vacaciones/saldo", response_model=SaldoVacacionesResponse)
def mi_saldo_vacaciones(
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    return _saldo(db, empleado)


def _saldo(db: Session, empleado: Empleado) -> SaldoVacacionesResponse:
    gozados = db.query(SolicitudAutogestion).filter(
        SolicitudAutogestion.empleado_id == empleado.empleado_id,
        SolicitudAutogestion.tipo == "Vacaciones",
        SolicitudAutogestion.estado == ESTADO_APROBADA,
        SolicitudAutogestion.is_deleted.is_(False),
    ).all()
    dias_gozados = sum(s.dias for s in gozados)
    ingreso = empleado.fecha_ingreso or date.today()
    s = saldo_vacaciones(ingreso, dias_gozados)
    return SaldoVacacionesResponse(empleado_id=empleado.empleado_id, **s)


# ==========================================================================
# Aprobaciones del Gerente (y visibilidad de RRHH)
# ==========================================================================

@router.get("/solicitudes/pendientes", response_model=List[SolicitudResponse])
def solicitudes_pendientes(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Gerente", "RRHH", "Admin"])),
):
    """
    Gerente: solicitudes de su equipo (subárbol) por resolver.
    RRHH/Admin: todas las pendientes de la empresa.
    """
    q = db.query(SolicitudAutogestion).filter(
        SolicitudAutogestion.empresa_id == usuario_actual.empresa_id,
        SolicitudAutogestion.estado == ESTADO_PENDIENTE,
        SolicitudAutogestion.is_deleted.is_(False),
    )
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None:
        q = q.filter(SolicitudAutogestion.empleado_id.in_(alcance))
    return [_to_response(db, s) for s in q.order_by(desc(SolicitudAutogestion.fecha_creacion)).all()]


@router.get("/solicitudes", response_model=List[SolicitudResponse])
def listar_solicitudes(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Gerente", "RRHH", "Admin"])),
):
    """Historial completo de solicitudes según el alcance del rol."""
    q = db.query(SolicitudAutogestion).filter(
        SolicitudAutogestion.empresa_id == usuario_actual.empresa_id,
        SolicitudAutogestion.is_deleted.is_(False),
    )
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None:
        q = q.filter(SolicitudAutogestion.empleado_id.in_(alcance))
    return [_to_response(db, s) for s in q.order_by(desc(SolicitudAutogestion.fecha_creacion)).all()]


@router.patch("/solicitudes/{solicitud_id}/resolver", response_model=SolicitudResponse)
def resolver_solicitud(
    solicitud_id: int,
    datos: SolicitudResolver,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Gerente", "RRHH", "Admin"])),
):
    solicitud = db.query(SolicitudAutogestion).filter(
        SolicitudAutogestion.solicitud_id == solicitud_id,
        SolicitudAutogestion.empresa_id == usuario_actual.empresa_id,
        SolicitudAutogestion.is_deleted.is_(False),
    ).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if solicitud.estado != ESTADO_PENDIENTE:
        raise HTTPException(status_code=400, detail="La solicitud ya fue resuelta.")

    # Aislamiento: el Gerente solo resuelve solicitudes de su subárbol.
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None and solicitud.empleado_id not in alcance:
        raise HTTPException(status_code=403, detail="No puedes resolver solicitudes fuera de tu equipo.")

    solicitud.estado = ESTADO_APROBADA if datos.aprobar else ESTADO_RECHAZADA
    solicitud.resuelto_por = usuario_actual.usuario_id
    solicitud.comentario_resolucion = datos.comentario
    solicitud.fecha_resolucion = datetime.utcnow()
    db.commit()
    db.refresh(solicitud)

    # Notificar al empleado y, si la resolvió el Gerente y fue aprobada, a RRHH.
    emp = db.query(Empleado).filter(Empleado.empleado_id == solicitud.empleado_id).first()
    estado_txt = "aprobada" if datos.aprobar else "rechazada"
    if emp and emp.usuario_id:
        crear_notificacion(
            db, solicitud.empresa_id, f"Tu solicitud fue {estado_txt}",
            f"Tu solicitud de {solicitud.tipo.lower()} ({solicitud.fecha_inicio} a {solicitud.fecha_fin}) fue {estado_txt}.",
            emp.usuario_id,
        )
    if datos.aprobar and usuario_actual.rol == "Gerente":
        nombre = _nombre(db, solicitud.empleado_id)
        for admin in db.query(Usuario).filter(
            Usuario.empresa_id == solicitud.empresa_id,
            Usuario.rol.in_(["RRHH", "Admin"]),
            Usuario.is_deleted.is_(False),
        ).all():
            crear_notificacion(
                db, solicitud.empresa_id, "Solicitud aprobada por el Gerente",
                f"El Gerente aprobó {solicitud.tipo.lower()} de {nombre} ({solicitud.fecha_inicio} a {solicitud.fecha_fin}). Considérala en el cierre.",
                admin.usuario_id,
            )

    registrar_auditoria(db, usuario_actual.usuario_id, f"RESOLVER_SOLICITUD_{estado_txt.upper()}", "Beneficios",
                        {"solicitud_id": solicitud_id, "empleado_id": solicitud.empleado_id})
    return _to_response(db, solicitud)


# ==========================================================================
# Validación de sobretiempo (Gerente)
# ==========================================================================

@router.get("/sobretiempo/pendientes", response_model=List[SobretiempoResponse])
def sobretiempo_pendiente(
    periodo: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Gerente", "RRHH", "Admin"])),
):
    q = db.query(HorasPeriodo).filter(
        HorasPeriodo.empresa_id == usuario_actual.empresa_id,
        HorasPeriodo.is_deleted.is_(False),
        (HorasPeriodo.horas_extra_25 + HorasPeriodo.horas_extra_35 + HorasPeriodo.horas_nocturnas) > 0,
    )
    if periodo:
        q = q.filter(HorasPeriodo.periodo == periodo)
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None:
        q = q.filter(HorasPeriodo.empleado_id.in_(alcance))
    salida = []
    for h in q.order_by(desc(HorasPeriodo.periodo)).all():
        salida.append(SobretiempoResponse(
            id=h.id, empleado_id=h.empleado_id, empleado_nombre=_nombre(db, h.empleado_id),
            periodo=h.periodo, horas_extra_25=h.horas_extra_25, horas_extra_35=h.horas_extra_35,
            horas_nocturnas=h.horas_nocturnas, estado_aprobacion=h.estado_aprobacion or "Pendiente",
        ))
    return salida


@router.patch("/sobretiempo/{registro_id}/resolver", response_model=SobretiempoResponse)
def resolver_sobretiempo(
    registro_id: int,
    datos: SobretiempoResolver,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Gerente", "RRHH", "Admin"])),
):
    h = db.query(HorasPeriodo).filter(
        HorasPeriodo.id == registro_id,
        HorasPeriodo.empresa_id == usuario_actual.empresa_id,
        HorasPeriodo.is_deleted.is_(False),
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Registro de horas no encontrado")
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None and h.empleado_id not in alcance:
        raise HTTPException(status_code=403, detail="Fuera de tu equipo.")

    h.estado_aprobacion = "Aprobado" if datos.aprobar else "Rechazado"
    h.aprobado_por = usuario_actual.usuario_id
    h.fecha_aprobacion = datetime.utcnow()
    db.commit()
    db.refresh(h)
    return SobretiempoResponse(
        id=h.id, empleado_id=h.empleado_id, empleado_nombre=_nombre(db, h.empleado_id),
        periodo=h.periodo, horas_extra_25=h.horas_extra_25, horas_extra_35=h.horas_extra_35,
        horas_nocturnas=h.horas_nocturnas, estado_aprobacion=h.estado_aprobacion,
    )


# ==========================================================================
# Evaluación de desempeño / kardex (Gerente)
# ==========================================================================

@router.post("/evaluaciones", response_model=EvaluacionResponse, status_code=status.HTTP_201_CREATED)
def crear_evaluacion(
    datos: EvaluacionCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Gerente", "RRHH", "Admin"])),
):
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None and datos.empleado_id not in alcance:
        raise HTTPException(status_code=403, detail="Solo puedes evaluar a tu equipo.")
    if datos.puntaje is not None and not (1 <= datos.puntaje <= 5):
        raise HTTPException(status_code=400, detail="El puntaje debe estar entre 1 y 5.")

    ev = EvaluacionDesempeno(
        empresa_id=usuario_actual.empresa_id,
        empleado_id=datos.empleado_id,
        evaluado_por=usuario_actual.usuario_id,
        tipo=datos.tipo,
        periodo=datos.periodo,
        puntaje=datos.puntaje,
        comentario=datos.comentario,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return EvaluacionResponse(
        evaluacion_id=ev.evaluacion_id, empleado_id=ev.empleado_id,
        empleado_nombre=_nombre(db, ev.empleado_id), tipo=ev.tipo, periodo=ev.periodo,
        puntaje=ev.puntaje, comentario=ev.comentario, fecha_creacion=ev.fecha_creacion,
    )


@router.get("/evaluaciones/{empleado_id}", response_model=List[EvaluacionResponse])
def listar_evaluaciones(
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Gerente", "RRHH", "Admin"])),
):
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None and empleado_id not in alcance:
        raise HTTPException(status_code=403, detail="Fuera de tu equipo.")
    filas = db.query(EvaluacionDesempeno).filter(
        EvaluacionDesempeno.empleado_id == empleado_id,
        EvaluacionDesempeno.empresa_id == usuario_actual.empresa_id,
        EvaluacionDesempeno.is_deleted.is_(False),
    ).order_by(desc(EvaluacionDesempeno.fecha_creacion)).all()
    return [
        EvaluacionResponse(
            evaluacion_id=e.evaluacion_id, empleado_id=e.empleado_id,
            empleado_nombre=_nombre(db, e.empleado_id), tipo=e.tipo, periodo=e.periodo,
            puntaje=e.puntaje, comentario=e.comentario, fecha_creacion=e.fecha_creacion,
        ) for e in filas
    ]


# ==========================================================================
# Cálculo de beneficios sociales (RRHH/Admin)
# ==========================================================================

def _persistir_beneficio(db: Session, usuario: Usuario, empleado_id: int, resultado: dict) -> BeneficioSocial:
    b = BeneficioSocial(
        empresa_id=usuario.empresa_id,
        empleado_id=empleado_id,
        tipo=resultado["tipo"],
        periodo=resultado["periodo"],
        meses_computables=resultado.get("meses_computables"),
        remuneracion_computable=resultado.get("remuneracion_computable"),
        monto=resultado["monto"],
        detalle=json.dumps(resultado, default=str),
        calculado_por=usuario.usuario_id,
    )
    db.add(b)
    return b


def _beneficio_response(db: Session, b: BeneficioSocial) -> BeneficioResponse:
    detalle = None
    if b.detalle:
        try:
            detalle = json.loads(b.detalle)
        except Exception:
            detalle = None
    return BeneficioResponse(
        beneficio_id=b.beneficio_id, empleado_id=b.empleado_id,
        empleado_nombre=_nombre(db, b.empleado_id), tipo=b.tipo, periodo=b.periodo,
        meses_computables=b.meses_computables, remuneracion_computable=b.remuneracion_computable,
        monto=b.monto, detalle=detalle, estado=b.estado, fecha_calculo=b.fecha_calculo,
    )


@router.post("/gratificaciones/calcular", response_model=List[BeneficioResponse])
def calcular_gratificaciones(
    datos: GratificacionRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    if datos.semestre not in ("Julio", "Diciembre"):
        raise HTTPException(status_code=400, detail="Semestre debe ser 'Julio' o 'Diciembre'.")
    params = cargar_parametros_fiscales(db)
    regimen = _regimen(db, usuario_actual.empresa_id)
    empleados = _empleados_en_alcance(db, usuario_actual, datos.empleado_id)
    if not empleados:
        raise HTTPException(status_code=404, detail="No hay empleados en tu alcance.")

    creados = []
    for emp in empleados:
        sueldo = _sueldo_vigente(db, emp.empleado_id)
        if sueldo <= 0:
            continue
        res = calcular_gratificacion(
            sueldo, emp.fecha_ingreso or date(datos.anio, 1, 1),
            datos.semestre, datos.anio, regimen, params,
        )
        creados.append(_persistir_beneficio(db, usuario_actual, emp.empleado_id, res))
    db.commit()
    for b in creados:
        db.refresh(b)
    registrar_auditoria(db, usuario_actual.usuario_id, "CALCULAR_GRATIFICACIONES", "Beneficios",
                        {"semestre": datos.semestre, "anio": datos.anio, "n": len(creados)})
    return [_beneficio_response(db, b) for b in creados]


@router.post("/cts/calcular", response_model=List[BeneficioResponse])
def calcular_cts_endpoint(
    datos: CtsRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    if datos.periodo_cts not in ("Mayo", "Noviembre"):
        raise HTTPException(status_code=400, detail="Periodo CTS debe ser 'Mayo' o 'Noviembre'.")
    regimen = _regimen(db, usuario_actual.empresa_id)
    empleados = _empleados_en_alcance(db, usuario_actual, datos.empleado_id)
    if not empleados:
        raise HTTPException(status_code=404, detail="No hay empleados en tu alcance.")

    creados = []
    for emp in empleados:
        sueldo = _sueldo_vigente(db, emp.empleado_id)
        if sueldo <= 0:
            continue
        # Última gratificación registrada para el 1/6 de la remuneración computable.
        ultima_grati = db.query(BeneficioSocial).filter(
            BeneficioSocial.empleado_id == emp.empleado_id,
            BeneficioSocial.tipo == "Gratificacion",
            BeneficioSocial.is_deleted.is_(False),
        ).order_by(desc(BeneficioSocial.fecha_calculo)).first()
        monto_grati = Decimal(str(ultima_grati.monto)) if ultima_grati else Decimal("0")
        res = calcular_cts(
            sueldo, emp.fecha_ingreso or date(datos.anio, 1, 1),
            datos.periodo_cts, datos.anio, monto_grati, regimen,
        )
        creados.append(_persistir_beneficio(db, usuario_actual, emp.empleado_id, res))
    db.commit()
    for b in creados:
        db.refresh(b)
    registrar_auditoria(db, usuario_actual.usuario_id, "CALCULAR_CTS", "Beneficios",
                        {"periodo": datos.periodo_cts, "anio": datos.anio, "n": len(creados)})
    return [_beneficio_response(db, b) for b in creados]


@router.post("/liquidaciones/calcular", response_model=BeneficioResponse)
def calcular_liquidacion_endpoint(
    datos: LiquidacionRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    empleados = _empleados_en_alcance(db, usuario_actual, datos.empleado_id)
    if not empleados:
        raise HTTPException(status_code=404, detail="Empleado no encontrado en tu alcance.")
    emp = empleados[0]
    sueldo = _sueldo_vigente(db, emp.empleado_id)
    params = cargar_parametros_fiscales(db)
    regimen = _regimen(db, usuario_actual.empresa_id)

    ultima_grati = db.query(BeneficioSocial).filter(
        BeneficioSocial.empleado_id == emp.empleado_id,
        BeneficioSocial.tipo == "Gratificacion",
        BeneficioSocial.is_deleted.is_(False),
    ).order_by(desc(BeneficioSocial.fecha_calculo)).first()
    monto_grati = Decimal(str(ultima_grati.monto)) if ultima_grati else Decimal("0")

    res = calcular_liquidacion(
        sueldo, emp.fecha_ingreso or datos.fecha_cese, datos.fecha_cese,
        datos.dias_vacaciones_pendientes, monto_grati, regimen, params,
    )
    b = _persistir_beneficio(db, usuario_actual, emp.empleado_id, res)
    db.commit()
    db.refresh(b)
    registrar_auditoria(db, usuario_actual.usuario_id, "CALCULAR_LIQUIDACION", "Beneficios",
                        {"empleado_id": emp.empleado_id, "fecha_cese": str(datos.fecha_cese)})
    return _beneficio_response(db, b)


@router.get("/beneficios", response_model=List[BeneficioResponse])
def listar_beneficios(
    tipo: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin", "Gerente"])),
):
    q = db.query(BeneficioSocial).filter(
        BeneficioSocial.empresa_id == usuario_actual.empresa_id,
        BeneficioSocial.is_deleted.is_(False),
    )
    if tipo:
        q = q.filter(BeneficioSocial.tipo == tipo)
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None:
        q = q.filter(BeneficioSocial.empleado_id.in_(alcance))
    return [_beneficio_response(db, b) for b in q.order_by(desc(BeneficioSocial.fecha_calculo)).all()]


@router.patch("/beneficios/{beneficio_id}/pagar", response_model=BeneficioResponse)
def marcar_beneficio_pagado(
    beneficio_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    b = db.query(BeneficioSocial).filter(
        BeneficioSocial.beneficio_id == beneficio_id,
        BeneficioSocial.empresa_id == usuario_actual.empresa_id,
        BeneficioSocial.is_deleted.is_(False),
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Beneficio no encontrado")
    b.estado = "Pagado"
    db.commit()
    db.refresh(b)
    return _beneficio_response(db, b)
