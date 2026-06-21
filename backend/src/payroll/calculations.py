from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

# Constantes tributarias Perú 2024
UIT = Decimal("5150")
TASA_ONP = Decimal("0.13")
TASA_AFP_OBLIGATORIO = Decimal("0.10")
TASA_AFP_PRIMA_SEGURO = Decimal("0.0174")
TASA_AFP_COMISION_FLUJO = Decimal("0.0069")
TASA_AFP_TOTAL = TASA_AFP_OBLIGATORIO + TASA_AFP_PRIMA_SEGURO + TASA_AFP_COMISION_FLUJO  # ~12.43%
TASA_ESSALUD = Decimal("0.09")  # Aporte empleador, no se descuenta al trabajador

# Tramos IR 5ta categoría sobre renta neta (renta bruta - 7 UIT)
TRAMOS_IR = [
    (5 * UIT, Decimal("0.08")),
    (15 * UIT, Decimal("0.14")),
    (15 * UIT, Decimal("0.17")),
    (10 * UIT, Decimal("0.20")),
    (Decimal("999999999"), Decimal("0.30")),
]


def _r(valor: Decimal) -> Decimal:
    return valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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
) -> Decimal:
    """
    ONP: 13% fijo.
    AFP: porcentaje_afp si se provee, si no usa tasa estándar (~12.43%).
    """
    if tipo_pension == "ONP":
        return _r(remuneracion_computable * TASA_ONP)
    if tipo_pension == "AFP":
        tasa = porcentaje_afp if porcentaje_afp else TASA_AFP_TOTAL
        return _r(remuneracion_computable * tasa)
    return Decimal("0")


def calcular_impuesto_renta_5ta(remuneracion_mensual_bruta: Decimal) -> Decimal:
    """
    Retención mensual IR 5ta categoría (Perú).
    Proyección anual = mensual × 14 (12 meses + 2 gratificaciones).
    Deducción: 7 UIT. Tramos progresivos sobre la renta neta anual.
    """
    renta_bruta_anual = remuneracion_mensual_bruta * 14
    renta_neta = renta_bruta_anual - (7 * UIT)

    if renta_neta <= 0:
        return Decimal("0")

    impuesto_anual = Decimal("0")
    restante = renta_neta
    for limite, tasa in TRAMOS_IR:
        if restante <= 0:
            break
        tramo = min(restante, limite)
        impuesto_anual += tramo * tasa
        restante -= tramo

    return _r(impuesto_anual / 12)


def calcular_planilla_empleado(
    sueldo_base: Decimal,
    horas_contrato_mes: Decimal,
    horas_ausentes_injustificadas: Decimal,
    tipo_pension: str,
    haberes: Decimal = Decimal("0"),
    porcentaje_afp: Optional[Decimal] = None,
) -> dict:
    """
    Motor de cálculo principal (RF-11).
    Devuelve un dict con todos los conceptos de la boleta.
    """
    sueldo_base = Decimal(str(sueldo_base))
    horas_contrato_mes = Decimal(str(horas_contrato_mes))
    horas_ausentes_injustificadas = Decimal(str(horas_ausentes_injustificadas))
    haberes = Decimal(str(haberes))

    horas_trabajadas = max(Decimal("0"), horas_contrato_mes - horas_ausentes_injustificadas)

    descuento_inasistencias = calcular_descuento_inasistencias(
        sueldo_base, horas_contrato_mes, horas_ausentes_injustificadas
    )

    # Remuneración computable = base - descuento inasistencias + otros haberes
    remuneracion_computable = sueldo_base - descuento_inasistencias + haberes

    aporte_pension = calcular_aporte_pension(remuneracion_computable, tipo_pension, porcentaje_afp)
    impuesto_renta = calcular_impuesto_renta_5ta(remuneracion_computable)

    total_descuentos = descuento_inasistencias + aporte_pension + impuesto_renta
    sueldo_neto = remuneracion_computable - aporte_pension - impuesto_renta
    aporte_empleador_essalud = _r(sueldo_base * TASA_ESSALUD)

    return {
        "sueldo_base": sueldo_base,
        "horas_contrato_mes": horas_contrato_mes,
        "horas_trabajadas": horas_trabajadas,
        "horas_ausentes": horas_ausentes_injustificadas,
        "descuento_inasistencias": descuento_inasistencias,
        "haberes": haberes,
        "total_ingresos_brutos": remuneracion_computable,
        "tipo_pension": tipo_pension,
        "aporte_pension": aporte_pension,
        "impuesto_renta_5ta": impuesto_renta,
        "total_descuentos": total_descuentos,
        "sueldo_neto": sueldo_neto,
        "aporte_empleador_essalud": aporte_empleador_essalud,
    }
