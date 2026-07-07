from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict

from src.core.fiscal import (
    PARAMETROS_DEFAULT,
    CLAVE_UIT,
    CLAVE_TASA_ONP,
    CLAVE_TASA_AFP_APORTE,
    CLAVE_TASA_AFP_PRIMA,
    CLAVE_TASA_AFP_COMISION,
    CLAVE_TASA_ESSALUD,
    config_sector,
)

# Recargos legales de segmentación horaria (Perú).
RECARGO_EXTRA_25 = Decimal("1.25")   # primeras 2 horas de sobretiempo
RECARGO_EXTRA_35 = Decimal("1.35")   # horas de sobretiempo siguientes
RECARGO_NOCTURNO = Decimal("0.35")   # sobretasa nocturna (22:00–06:00) sobre valor-hora

# ==========================================================================
# Fase 1: los valores fiscales dejan de estar hardcodeados. El motor recibe
# un dict `params` (proveniente de `cargar_parametros_fiscales`). Si no se
# provee, cae a PARAMETROS_DEFAULT para no romper llamadas directas ni tests.
# ==========================================================================


def _r(valor: Decimal) -> Decimal:
    return valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _params(params: Optional[Dict[str, Decimal]]) -> Dict[str, Decimal]:
    """Normaliza el dict de parámetros a Decimal, usando defaults como respaldo."""
    base = dict(PARAMETROS_DEFAULT)
    if params:
        for k, v in params.items():
            base[k] = Decimal(str(v))
    return base


def tasa_afp_total(params: Optional[Dict[str, Decimal]] = None) -> Decimal:
    p = _params(params)
    return p[CLAVE_TASA_AFP_APORTE] + p[CLAVE_TASA_AFP_PRIMA] + p[CLAVE_TASA_AFP_COMISION]


def _tramos_ir(uit: Decimal):
    """Tramos progresivos de IR 5ta categoría en función de la UIT vigente."""
    return [
        (5 * uit, Decimal("0.08")),
        (15 * uit, Decimal("0.14")),
        (15 * uit, Decimal("0.17")),
        (10 * uit, Decimal("0.20")),
        (Decimal("999999999"), Decimal("0.30")),
    ]


def calcular_descuento_inasistencias(
    sueldo_base: Decimal,
    horas_contrato_mes: Decimal,
    horas_ausentes_a_descontar: Decimal,
) -> Decimal:
    """Descuento proporcional por horas no trabajadas que generan deducción."""
    if horas_contrato_mes <= 0 or horas_ausentes_a_descontar <= 0:
        return Decimal("0")
    valor_hora = sueldo_base / horas_contrato_mes
    return _r(valor_hora * min(horas_ausentes_a_descontar, horas_contrato_mes))


def calcular_aporte_pension(
    remuneracion_computable: Decimal,
    tipo_pension: str,
    porcentaje_afp: Optional[Decimal] = None,
    params: Optional[Dict[str, Decimal]] = None,
) -> Decimal:
    """
    ONP: tasa vigente (13% por defecto).
    AFP: porcentaje_afp si se provee, si no usa la tasa AFP total vigente (~12.43%).
    """
    p = _params(params)
    if tipo_pension == "ONP":
        return _r(remuneracion_computable * p[CLAVE_TASA_ONP])
    if tipo_pension == "AFP":
        tasa = porcentaje_afp if porcentaje_afp else tasa_afp_total(p)
        return _r(remuneracion_computable * tasa)
    return Decimal("0")


def calcular_impuesto_renta_5ta(
    remuneracion_mensual_bruta: Decimal,
    params: Optional[Dict[str, Decimal]] = None,
) -> Decimal:
    """
    Retención mensual IR 5ta categoría (Perú).
    Proyección anual = mensual × 14 (12 meses + 2 gratificaciones).
    Deducción: 7 UIT. Tramos progresivos sobre la renta neta anual.
    """
    p = _params(params)
    uit = p[CLAVE_UIT]
    renta_bruta_anual = remuneracion_mensual_bruta * 14
    renta_neta = renta_bruta_anual - (7 * uit)

    if renta_neta <= 0:
        return Decimal("0")

    impuesto_anual = Decimal("0")
    restante = renta_neta
    for limite, tasa in _tramos_ir(uit):
        if restante <= 0:
            break
        tramo = min(restante, limite)
        impuesto_anual += tramo * tasa
        restante -= tramo

    return _r(impuesto_anual / 12)


def calcular_gratificacion(
    sueldo_base: Decimal,
    meses_computados: int,
    tipo_pension: str,
    porcentaje_afp: Optional[Decimal] = None,
    params: Optional[Dict[str, Decimal]] = None,
) -> dict:
    """
    Gratificación legal (Fiestas Patrias / Navidad).
    Remuneración computable = sueldo básico. 1 sueldo si laboró el semestre
    completo (6 meses); proporcional si ingresó durante el semestre.
    Está afecta a pensión (ONP/AFP) pero NO a EsSalud: en su lugar el
    empleador transfiere al trabajador una bonificación extraordinaria del 9%
    (Ley 29351), que no está sujeta a ningún descuento.
    """
    p = _params(params)
    sueldo_base = Decimal(str(sueldo_base))
    meses = min(6, max(0, int(meses_computados)))

    gratificacion_bruta = _r(sueldo_base * meses / 6)
    bonificacion_extraordinaria = _r(gratificacion_bruta * Decimal("0.09"))
    aporte_pension = calcular_aporte_pension(gratificacion_bruta, tipo_pension, porcentaje_afp, p)
    monto_neto = gratificacion_bruta - aporte_pension + bonificacion_extraordinaria

    return {
        "meses_computados": meses,
        "remuneracion_computable": sueldo_base,
        "monto_bruto": gratificacion_bruta,
        "bonificacion_extraordinaria": bonificacion_extraordinaria,
        "aporte_pension": aporte_pension,
        "monto_neto": monto_neto,
    }


def calcular_cts(
    sueldo_base: Decimal,
    meses_computados: int,
    ultima_gratificacion: Decimal = Decimal("0"),
) -> dict:
    """
    Compensación por Tiempo de Servicios (depósito de mayo / noviembre).
    Remuneración computable = sueldo básico + 1/6 de la última gratificación
    percibida. CTS = remuneración computable × (meses del periodo / 12).
    Es intangible: no está afecta a pensión, IR ni ningún otro descuento.
    (Simplificación: se computa por meses completos de servicio en el
    semestre, sin prorrateo por fracción de día.)
    """
    sueldo_base = Decimal(str(sueldo_base))
    ultima_gratificacion = Decimal(str(ultima_gratificacion or 0))
    meses = min(6, max(0, int(meses_computados)))

    remuneracion_computable = _r(sueldo_base + (ultima_gratificacion / 6))
    monto_cts = _r(remuneracion_computable * meses / 12)

    return {
        "meses_computados": meses,
        "remuneracion_computable": remuneracion_computable,
        "monto_bruto": monto_cts,
        "monto_neto": monto_cts,
    }


def calcular_planilla_empleado(
    sueldo_base: Decimal,
    horas_contrato_mes: Decimal,
    horas_ausentes_injustificadas: Decimal,
    tipo_pension: str,
    haberes: Decimal = Decimal("0"),
    porcentaje_afp: Optional[Decimal] = None,
    params: Optional[Dict[str, Decimal]] = None,
    perfil_contrato: str = "Comun",
    horas_extra_25: Decimal = Decimal("0"),
    horas_extra_35: Decimal = Decimal("0"),
    horas_nocturnas: Decimal = Decimal("0"),
    regimen: str = "General",
) -> dict:
    """
    Motor de cálculo principal (RF-11 + Fase 2).
    Añade segmentación horaria (extra 25%/35%, nocturnas) y el bono inamovible del
    sector según `perfil_contrato`. `params` proviene de `cargar_parametros_fiscales`.
    """
    p = _params(params)
    sueldo_base = Decimal(str(sueldo_base))
    horas_contrato_mes = Decimal(str(horas_contrato_mes))
    horas_ausentes_injustificadas = Decimal(str(horas_ausentes_injustificadas))
    haberes = Decimal(str(haberes))
    horas_extra_25 = Decimal(str(horas_extra_25 or 0))
    horas_extra_35 = Decimal(str(horas_extra_35 or 0))
    horas_nocturnas = Decimal(str(horas_nocturnas or 0))

    horas_trabajadas = max(Decimal("0"), horas_contrato_mes - horas_ausentes_injustificadas)

    descuento_inasistencias = calcular_descuento_inasistencias(
        sueldo_base, horas_contrato_mes, horas_ausentes_injustificadas
    )

    # Fase 2: segmentación horaria valorizada sobre el valor-hora del contrato.
    valor_hora = (sueldo_base / horas_contrato_mes) if horas_contrato_mes > 0 else Decimal("0")
    pago_horas_extra_25 = _r(valor_hora * RECARGO_EXTRA_25 * horas_extra_25)
    pago_horas_extra_35 = _r(valor_hora * RECARGO_EXTRA_35 * horas_extra_35)
    pago_horas_nocturnas = _r(valor_hora * RECARGO_NOCTURNO * horas_nocturnas)

    # Fase 2: bono inamovible del sector (minero/agrario) según perfil.
    cfg = config_sector(perfil_contrato)
    bonos_sector = Decimal("0")
    if cfg["clave_bono"]:
        bonos_sector = _r(p.get(cfg["clave_bono"], Decimal("0")))

    haberes_totales = (
        haberes + pago_horas_extra_25 + pago_horas_extra_35 + pago_horas_nocturnas + bonos_sector
    )

    # Remuneración computable = base - inasistencias + haberes + extras + bonos
    remuneracion_computable = sueldo_base - descuento_inasistencias + haberes_totales

    aporte_pension = calcular_aporte_pension(remuneracion_computable, tipo_pension, porcentaje_afp, p)
    impuesto_renta = calcular_impuesto_renta_5ta(remuneracion_computable, p)

    total_descuentos = descuento_inasistencias + aporte_pension + impuesto_renta
    sueldo_neto = remuneracion_computable - aporte_pension - impuesto_renta

    # EsSalud: régimen MYPE Micro usa SIS subsidiado (aporte del empleador = 0).
    if regimen == "MYPE_Micro":
        aporte_empleador_essalud = Decimal("0")
    else:
        aporte_empleador_essalud = _r(sueldo_base * p[CLAVE_TASA_ESSALUD])

    return {
        "sueldo_base": sueldo_base,
        "horas_contrato_mes": horas_contrato_mes,
        "horas_trabajadas": horas_trabajadas,
        "horas_ausentes": horas_ausentes_injustificadas,
        "descuento_inasistencias": descuento_inasistencias,
        "haberes": haberes,
        "perfil_contrato": perfil_contrato,
        "pago_horas_extra_25": pago_horas_extra_25,
        "pago_horas_extra_35": pago_horas_extra_35,
        "pago_horas_nocturnas": pago_horas_nocturnas,
        "bonos_sector": bonos_sector,
        "valor_hora": _r(valor_hora),
        "total_ingresos_brutos": remuneracion_computable,
        "tipo_pension": tipo_pension,
        "aporte_pension": aporte_pension,
        "impuesto_renta_5ta": impuesto_renta,
        "total_descuentos": total_descuentos,
        "sueldo_neto": sueldo_neto,
        "aporte_empleador_essalud": aporte_empleador_essalud,
    }
