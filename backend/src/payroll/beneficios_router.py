from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import obtener_usuario_actual, obtener_empleado_actual, verificar_rol
from src.core.services import registrar_auditoria
from src.core.fiscal import cargar_parametros_fiscales
from src.hr.models import Empleado, Contrato
from src.payroll.beneficios_models import BeneficioSocial
from src.payroll.calculations import calcular_gratificacion, calcular_cts

router = APIRouter()


# ── Schemas inline (mismo patrón que turno_router.py / vacaciones_router.py) ──

class GenerarBeneficioRequest(BaseModel):
    periodo: str  # "YYYY-07"/"YYYY-12" para gratificación, "YYYY-05"/"YYYY-11" para CTS


class BeneficioResponse(BaseModel):
    id: int
    empleado_id: int
    nombre_empleado: Optional[str] = None
    tipo: str
    periodo: str
    meses_computados: float
    remuneracion_computable: float
    monto_bruto: float
    bonificacion_extraordinaria: float
    aporte_pension: float
    monto_neto: float
    estado: str

    class Config:
        from_attributes = True


# ── Rangos legales de cada beneficio (Perú) ──

def _rango_gratificacion(periodo: str) -> tuple[date, date]:
    anio, mes = (int(x) for x in periodo.split("-"))
    if mes == 7:
        return date(anio, 1, 1), date(anio, 6, 30)
    if mes == 12:
        return date(anio, 7, 1), date(anio, 12, 31)
    raise HTTPException(status_code=400, detail="La gratificación solo se genera para julio (07) o diciembre (12).")


def _rango_cts(periodo: str) -> tuple[date, date]:
    anio, mes = (int(x) for x in periodo.split("-"))
    if mes == 5:
        return date(anio - 1, 11, 1), date(anio, 4, 30)
    if mes == 11:
        return date(anio, 5, 1), date(anio, 10, 31)
    raise HTTPException(status_code=400, detail="La CTS solo se genera para mayo (05) o noviembre (11).")


def _meses_en_rango(fecha_ingreso: Optional[date], inicio: date, fin: date) -> int:
    """Meses completos laborados dentro de [inicio, fin], acotado por fecha_ingreso."""
    if not fecha_ingreso or fecha_ingreso > fin:
        return 0
    desde = max(fecha_ingreso, inicio)
    meses = (fin.year - desde.year) * 12 + (fin.month - desde.month) + 1
    return max(0, min(6, meses))


def _contrato_vigente(db: Session, empleado_id: int) -> Optional[Contrato]:
    return db.query(Contrato).filter(
        Contrato.empleado_id == empleado_id,
        Contrato.estado == "Vigente",
        Contrato.is_deleted.is_(False),
    ).first()


def _empleados_activos(db: Session, empresa_id: int) -> List[Empleado]:
    return db.query(Empleado).filter(
        Empleado.empresa_id == empresa_id,
        Empleado.estado == "Activo",
        Empleado.is_deleted.is_(False),
    ).all()


def _a_response(b: BeneficioSocial, nombre: Optional[str] = None) -> BeneficioResponse:
    return BeneficioResponse(
        id=b.id, empleado_id=b.empleado_id, nombre_empleado=nombre, tipo=b.tipo, periodo=b.periodo,
        meses_computados=float(b.meses_computados), remuneracion_computable=float(b.remuneracion_computable),
        monto_bruto=float(b.monto_bruto), bonificacion_extraordinaria=float(b.bonificacion_extraordinaria or 0),
        aporte_pension=float(b.aporte_pension or 0), monto_neto=float(b.monto_neto), estado=b.estado,
    )


# ==========================================================================
# Generación (Admin / RRHH)
# ==========================================================================

@router.post("/gratificacion/generar", response_model=List[BeneficioResponse], status_code=status.HTTP_201_CREATED)
def generar_gratificacion(
    datos: GenerarBeneficioRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    """Calcula la gratificación (Jul/Dic) de todos los empleados activos con contrato vigente."""
    inicio, fin = _rango_gratificacion(datos.periodo)

    if db.query(BeneficioSocial).filter(
        BeneficioSocial.empresa_id == usuario_actual.empresa_id,
        BeneficioSocial.tipo == "Gratificacion",
        BeneficioSocial.periodo == datos.periodo,
        BeneficioSocial.is_deleted.is_(False),
    ).first():
        raise HTTPException(status_code=409, detail=f"Ya se generó la gratificación del periodo {datos.periodo}")

    params = cargar_parametros_fiscales(db)
    generados: List[BeneficioSocial] = []
    for empleado in _empleados_activos(db, usuario_actual.empresa_id):
        contrato = _contrato_vigente(db, empleado.empleado_id)
        if not contrato:
            continue
        meses = _meses_en_rango(empleado.fecha_ingreso, inicio, fin)
        if meses <= 0:
            continue
        resultado = calcular_gratificacion(
            sueldo_base=Decimal(str(contrato.sueldo_base)),
            meses_computados=meses,
            tipo_pension=empleado.tipo_pension or "ONP",
            porcentaje_afp=empleado.porcentaje_afp,
            params=params,
        )
        beneficio = BeneficioSocial(
            empresa_id=usuario_actual.empresa_id,
            empleado_id=empleado.empleado_id,
            tipo="Gratificacion",
            periodo=datos.periodo,
            meses_computados=resultado["meses_computados"],
            remuneracion_computable=resultado["remuneracion_computable"],
            monto_bruto=resultado["monto_bruto"],
            bonificacion_extraordinaria=resultado["bonificacion_extraordinaria"],
            aporte_pension=resultado["aporte_pension"],
            monto_neto=resultado["monto_neto"],
            calculado_por=usuario_actual.usuario_id,
        )
        db.add(beneficio)
        generados.append(beneficio)

    if not generados:
        raise HTTPException(status_code=404, detail="No hay empleados elegibles (con contrato vigente e ingreso dentro del semestre).")

    db.commit()
    for b in generados:
        db.refresh(b)
    registrar_auditoria(db, usuario_actual.usuario_id, "GENERAR_GRATIFICACION", "Beneficios Sociales",
                        {"periodo": datos.periodo, "empleados": len(generados)})

    nombres = {e.empleado_id: e.nombre for e in _empleados_activos(db, usuario_actual.empresa_id)}
    return [_a_response(b, nombres.get(b.empleado_id)) for b in generados]


@router.post("/cts/generar", response_model=List[BeneficioResponse], status_code=status.HTTP_201_CREATED)
def generar_cts(
    datos: GenerarBeneficioRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    """Calcula la CTS (mayo/noviembre) de todos los empleados activos con contrato vigente."""
    inicio, fin = _rango_cts(datos.periodo)

    if db.query(BeneficioSocial).filter(
        BeneficioSocial.empresa_id == usuario_actual.empresa_id,
        BeneficioSocial.tipo == "CTS",
        BeneficioSocial.periodo == datos.periodo,
        BeneficioSocial.is_deleted.is_(False),
    ).first():
        raise HTTPException(status_code=409, detail=f"Ya se generó la CTS del periodo {datos.periodo}")

    generados: List[BeneficioSocial] = []
    for empleado in _empleados_activos(db, usuario_actual.empresa_id):
        contrato = _contrato_vigente(db, empleado.empleado_id)
        if not contrato:
            continue
        meses = _meses_en_rango(empleado.fecha_ingreso, inicio, fin)
        if meses <= 0:
            continue

        # 1/6 de la última gratificación percibida (sexto de gratificación).
        ultima_grat = db.query(BeneficioSocial).filter(
            BeneficioSocial.empleado_id == empleado.empleado_id,
            BeneficioSocial.tipo == "Gratificacion",
            BeneficioSocial.is_deleted.is_(False),
        ).order_by(BeneficioSocial.periodo.desc()).first()

        resultado = calcular_cts(
            sueldo_base=Decimal(str(contrato.sueldo_base)),
            meses_computados=meses,
            ultima_gratificacion=Decimal(str(ultima_grat.monto_bruto)) if ultima_grat else Decimal("0"),
        )
        beneficio = BeneficioSocial(
            empresa_id=usuario_actual.empresa_id,
            empleado_id=empleado.empleado_id,
            tipo="CTS",
            periodo=datos.periodo,
            meses_computados=resultado["meses_computados"],
            remuneracion_computable=resultado["remuneracion_computable"],
            monto_bruto=resultado["monto_bruto"],
            monto_neto=resultado["monto_neto"],
            calculado_por=usuario_actual.usuario_id,
        )
        db.add(beneficio)
        generados.append(beneficio)

    if not generados:
        raise HTTPException(status_code=404, detail="No hay empleados elegibles (con contrato vigente e ingreso dentro del periodo).")

    db.commit()
    for b in generados:
        db.refresh(b)
    registrar_auditoria(db, usuario_actual.usuario_id, "GENERAR_CTS", "Beneficios Sociales",
                        {"periodo": datos.periodo, "empleados": len(generados)})

    nombres = {e.empleado_id: e.nombre for e in _empleados_activos(db, usuario_actual.empresa_id)}
    return [_a_response(b, nombres.get(b.empleado_id)) for b in generados]


@router.get("/", response_model=List[BeneficioResponse])
def listar_beneficios(
    tipo: Optional[str] = None,
    periodo: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    query = (
        db.query(BeneficioSocial, Empleado.nombre)
        .join(Empleado, Empleado.empleado_id == BeneficioSocial.empleado_id)
        .filter(
            BeneficioSocial.empresa_id == usuario_actual.empresa_id,
            BeneficioSocial.is_deleted.is_(False),
        )
    )
    if tipo:
        query = query.filter(BeneficioSocial.tipo == tipo)
    if periodo:
        query = query.filter(BeneficioSocial.periodo == periodo)
    resultados = query.order_by(BeneficioSocial.periodo.desc()).all()
    return [_a_response(b, nombre) for b, nombre in resultados]


@router.patch("/{beneficio_id}/marcar-pagado", response_model=BeneficioResponse)
def marcar_pagado(
    beneficio_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    beneficio = db.query(BeneficioSocial).filter(
        BeneficioSocial.id == beneficio_id,
        BeneficioSocial.empresa_id == usuario_actual.empresa_id,
        BeneficioSocial.is_deleted.is_(False),
    ).first()
    if not beneficio:
        raise HTTPException(status_code=404, detail="Beneficio no encontrado")
    if beneficio.estado == "Pagado":
        raise HTTPException(status_code=400, detail="Este beneficio ya fue marcado como pagado")

    from sqlalchemy import func as sa_func
    beneficio.estado = "Pagado"
    beneficio.fecha_pago = sa_func.now()
    db.commit()
    db.refresh(beneficio)
    registrar_auditoria(db, usuario_actual.usuario_id, "PAGAR_BENEFICIO", "Beneficios Sociales",
                        {"beneficio_id": beneficio_id, "tipo": beneficio.tipo, "periodo": beneficio.periodo})

    empleado = db.query(Empleado).filter(Empleado.empleado_id == beneficio.empleado_id).first()
    return _a_response(beneficio, empleado.nombre if empleado else None)


# ==========================================================================
# Autogestión (Empleado)
# ==========================================================================

@router.get("/mis-beneficios", response_model=List[BeneficioResponse])
def mis_beneficios(
    empleado: Empleado = Depends(obtener_empleado_actual),
    db: Session = Depends(get_db),
):
    beneficios = db.query(BeneficioSocial).filter(
        BeneficioSocial.empleado_id == empleado.empleado_id,
        BeneficioSocial.is_deleted.is_(False),
    ).order_by(BeneficioSocial.periodo.desc()).all()
    return [_a_response(b, empleado.nombre) for b in beneficios]
