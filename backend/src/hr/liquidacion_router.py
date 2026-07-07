from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import verificar_rol
from src.core.services import registrar_auditoria
from src.core.fiscal import cargar_parametros_fiscales
from src.hr.models import Empleado, Contrato
from src.hr.vacaciones_calculo import dias_devengados
from src.hr.vacaciones_models import SolicitudVacaciones
from src.hr.liquidacion_models import Liquidacion
from src.payroll.calculations import _r, calcular_gratificacion, calcular_cts
from src.payroll.beneficios_models import BeneficioSocial

router = APIRouter()

MOTIVOS_VALIDOS = {"Renuncia", "Despido", "Mutuo_acuerdo", "Fin_contrato"}


# ── Schemas inline ──

class LiquidacionCalcular(BaseModel):
    empleado_id: int
    fecha_cese: date
    motivo: str = "Renuncia"


class LiquidacionResponse(BaseModel):
    id: int
    empleado_id: int
    nombre_empleado: Optional[str] = None
    fecha_cese: date
    motivo: str
    dias_vacaciones_truncas: int
    monto_vacaciones_truncas: float
    meses_gratificacion_trunca: float
    monto_gratificacion_trunca: float
    bonificacion_extraordinaria: float
    meses_cts_trunca: float
    monto_cts_trunca: float
    monto_total: float
    estado: str

    class Config:
        from_attributes = True


# ── Rangos del semestre/periodo vigente en la fecha de cese ──

def _semestre_gratificacion(fecha: date) -> tuple[date, date]:
    if fecha.month <= 6:
        return date(fecha.year, 1, 1), date(fecha.year, 6, 30)
    return date(fecha.year, 7, 1), date(fecha.year, 12, 31)


def _periodo_cts(fecha: date) -> tuple[date, date]:
    if fecha.month in (11, 12):
        return date(fecha.year, 11, 1), date(fecha.year + 1, 4, 30)
    if fecha.month <= 4:
        return date(fecha.year - 1, 11, 1), date(fecha.year, 4, 30)
    return date(fecha.year, 5, 1), date(fecha.year, 10, 31)


def _meses_completos(fecha_ingreso: Optional[date], desde: date, hasta: date) -> int:
    """Meses completos de servicio entre max(fecha_ingreso, desde) y hasta (mismo criterio que vacaciones_calculo)."""
    inicio = max(fecha_ingreso, desde) if fecha_ingreso else desde
    if inicio > hasta:
        return 0
    meses = (hasta.year - inicio.year) * 12 + (hasta.month - inicio.month)
    if hasta.day < inicio.day:
        meses -= 1
    return max(0, min(6, meses))


def _a_response(liq: Liquidacion, nombre: Optional[str] = None) -> LiquidacionResponse:
    return LiquidacionResponse(
        id=liq.id, empleado_id=liq.empleado_id, nombre_empleado=nombre,
        fecha_cese=liq.fecha_cese, motivo=liq.motivo,
        dias_vacaciones_truncas=liq.dias_vacaciones_truncas, monto_vacaciones_truncas=float(liq.monto_vacaciones_truncas),
        meses_gratificacion_trunca=float(liq.meses_gratificacion_trunca), monto_gratificacion_trunca=float(liq.monto_gratificacion_trunca),
        bonificacion_extraordinaria=float(liq.bonificacion_extraordinaria),
        meses_cts_trunca=float(liq.meses_cts_trunca), monto_cts_trunca=float(liq.monto_cts_trunca),
        monto_total=float(liq.monto_total), estado=liq.estado,
    )


@router.post("/calcular", response_model=LiquidacionResponse, status_code=status.HTTP_201_CREATED)
def calcular_liquidacion(
    datos: LiquidacionCalcular,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    """
    Calcula la liquidación por cese (vacaciones truncas + gratificación trunca +
    CTS trunca) y, en el mismo acto, da de baja al empleado (mismo efecto que
    hr/router.py::desactivar_empleado: contrato vigente -> Vencido, empleado -> Inactivo).
    """
    if datos.motivo not in MOTIVOS_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Motivo inválido. Opciones: {', '.join(MOTIVOS_VALIDOS)}")

    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == datos.empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado en tu empresa")
    if empleado.estado == "Inactivo":
        raise HTTPException(status_code=400, detail="El empleado ya se encuentra inactivo")

    contrato = db.query(Contrato).filter(
        Contrato.empleado_id == datos.empleado_id,
        Contrato.estado == "Vigente",
        Contrato.is_deleted.is_(False),
    ).first()
    if not contrato:
        raise HTTPException(status_code=400, detail="El empleado no tiene un contrato vigente")

    sueldo_base = Decimal(str(contrato.sueldo_base))
    params = cargar_parametros_fiscales(db)

    # 1) Vacaciones truncas: saldo devengado a la fecha de cese, menos lo ya comprometido.
    devengados = dias_devengados(empleado.fecha_ingreso, datos.fecha_cese)
    comprometidos = db.query(sa_func.coalesce(sa_func.sum(SolicitudVacaciones.dias_solicitados), 0)).filter(
        SolicitudVacaciones.empleado_id == datos.empleado_id,
        SolicitudVacaciones.estado.in_(["Pendiente", "Aprobada"]),
        SolicitudVacaciones.is_deleted.is_(False),
    ).scalar()
    dias_truncos = max(0, devengados - int(comprometidos or 0))
    monto_vacaciones_truncas = _r(sueldo_base / 30 * dias_truncos)

    # 2) Gratificación trunca del semestre en curso.
    inicio_sem, _ = _semestre_gratificacion(datos.fecha_cese)
    meses_grat = _meses_completos(empleado.fecha_ingreso, inicio_sem, datos.fecha_cese)
    resultado_grat = calcular_gratificacion(
        sueldo_base=sueldo_base, meses_computados=meses_grat,
        tipo_pension=empleado.tipo_pension or "ONP", porcentaje_afp=empleado.porcentaje_afp, params=params,
    )

    # 3) CTS trunca del periodo en curso (usa el sexto de la gratificación recién calculada,
    #    o la última registrada si el cese cae justo al iniciar un semestre nuevo).
    inicio_cts, _ = _periodo_cts(datos.fecha_cese)
    meses_cts = _meses_completos(empleado.fecha_ingreso, inicio_cts, datos.fecha_cese)
    if resultado_grat["meses_computados"] > 0:
        ultima_gratificacion = resultado_grat["monto_bruto"]
    else:
        ultima_grat_bd = db.query(BeneficioSocial).filter(
            BeneficioSocial.empleado_id == datos.empleado_id,
            BeneficioSocial.tipo == "Gratificacion",
            BeneficioSocial.is_deleted.is_(False),
        ).order_by(BeneficioSocial.periodo.desc()).first()
        ultima_gratificacion = Decimal(str(ultima_grat_bd.monto_bruto)) if ultima_grat_bd else Decimal("0")
    resultado_cts = calcular_cts(sueldo_base=sueldo_base, meses_computados=meses_cts, ultima_gratificacion=ultima_gratificacion)

    monto_total = (
        monto_vacaciones_truncas
        + resultado_grat["monto_neto"]
        + resultado_cts["monto_neto"]
    )

    liquidacion = Liquidacion(
        empresa_id=usuario_actual.empresa_id,
        empleado_id=datos.empleado_id,
        fecha_cese=datos.fecha_cese,
        motivo=datos.motivo,
        dias_vacaciones_truncas=dias_truncos,
        monto_vacaciones_truncas=monto_vacaciones_truncas,
        meses_gratificacion_trunca=resultado_grat["meses_computados"],
        monto_gratificacion_trunca=resultado_grat["monto_neto"],
        bonificacion_extraordinaria=resultado_grat["bonificacion_extraordinaria"],
        meses_cts_trunca=resultado_cts["meses_computados"],
        monto_cts_trunca=resultado_cts["monto_neto"],
        monto_total=monto_total,
        calculado_por=usuario_actual.usuario_id,
    )
    db.add(liquidacion)

    # Efecto de baja: mismo tratamiento que hr/router.py::desactivar_empleado
    contrato.estado = "Vencido"
    empleado.estado = "Inactivo"

    db.commit()
    db.refresh(liquidacion)

    registrar_auditoria(db, usuario_actual.usuario_id, "CALCULAR_LIQUIDACION", "HR",
                        {"empleado_id": datos.empleado_id, "fecha_cese": str(datos.fecha_cese),
                         "motivo": datos.motivo, "monto_total": float(monto_total)})

    return _a_response(liquidacion, empleado.nombre)


@router.get("/", response_model=List[LiquidacionResponse])
def listar_liquidaciones(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    resultados = (
        db.query(Liquidacion, Empleado.nombre)
        .join(Empleado, Empleado.empleado_id == Liquidacion.empleado_id)
        .filter(Liquidacion.empresa_id == usuario_actual.empresa_id, Liquidacion.is_deleted.is_(False))
        .order_by(Liquidacion.fecha_calculo.desc())
        .all()
    )
    return [_a_response(liq, nombre) for liq, nombre in resultados]


@router.patch("/{liquidacion_id}/marcar-pagada", response_model=LiquidacionResponse)
def marcar_pagada(
    liquidacion_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    liquidacion = db.query(Liquidacion).filter(
        Liquidacion.id == liquidacion_id,
        Liquidacion.empresa_id == usuario_actual.empresa_id,
        Liquidacion.is_deleted.is_(False),
    ).first()
    if not liquidacion:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    if liquidacion.estado == "Pagada":
        raise HTTPException(status_code=400, detail="Esta liquidación ya fue marcada como pagada")

    liquidacion.estado = "Pagada"
    liquidacion.fecha_pago = sa_func.now()
    db.commit()
    db.refresh(liquidacion)
    registrar_auditoria(db, usuario_actual.usuario_id, "PAGAR_LIQUIDACION", "HR", {"liquidacion_id": liquidacion_id})

    empleado = db.query(Empleado).filter(Empleado.empleado_id == liquidacion.empleado_id).first()
    return _a_response(liquidacion, empleado.nombre if empleado else None)
