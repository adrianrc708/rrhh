"""
Fase 5 — Motor de cálculo de beneficios sociales (Perú).

Fórmulas de gratificaciones (Ley 27735), CTS (D.S. 001-97-TR) y liquidación por
cese. Son deterministas y devuelven, además del monto, un desglose legible para
la boleta/legajo y para que el Copiloto IA (Fase 4) lo explique.

El régimen laboral de la empresa modula el beneficio:
  - General       -> beneficio completo.
  - MYPE_Pequena  -> 50 % (media remuneración / medio depósito).
  - MYPE_Micro    -> no genera gratificación ni CTS (0).
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from typing import Dict, Optional

from src.core.fiscal import PARAMETROS_DEFAULT, CLAVE_TASA_ESSALUD

# Factor del beneficio según el régimen de la empresa.
FACTOR_REGIMEN = {
    "General": Decimal("1"),
    "MYPE_Pequena": Decimal("0.5"),
    "MYPE_Micro": Decimal("0"),
}


def _r(v: Decimal) -> Decimal:
    return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _factor(regimen: Optional[str]) -> Decimal:
    return FACTOR_REGIMEN.get(regimen or "General", Decimal("1"))


def meses_computables(desde: date, hasta: date, tope: int = 6) -> Decimal:
    """
    Meses (con fracción por días) trabajados dentro de una ventana. Un mes
    completo = 1; los días sueltos suman en treintavos. Se topea (semestre = 6,
    año = 12). Es la base común de gratificación/CTS.
    """
    if hasta < desde:
        return Decimal("0")
    meses = (hasta.year - desde.year) * 12 + (hasta.month - desde.month)
    dias_extra = hasta.day - desde.day + 1  # +1: día de ingreso computa
    total = Decimal(meses) + (Decimal(dias_extra) / Decimal("30"))
    if total < 0:
        total = Decimal("0")
    return min(total, Decimal(tope))


def calcular_gratificacion(
    sueldo_base: Decimal,
    fecha_ingreso: date,
    semestre: str,             # "Julio" (ene-jun) | "Diciembre" (jul-dic)
    anio: int,
    regimen: str = "General",
    params: Optional[Dict[str, Decimal]] = None,
) -> dict:
    """
    Gratificación de Fiestas Patrias (Julio) o Navidad (Diciembre).
    Base = (remuneración / 6) × meses computables del semestre.
    Se añade la bonificación extraordinaria (Ley 30334): el 9 % de EsSalud que el
    empleador entrega al trabajador junto a la gratificación.
    """
    p = params or PARAMETROS_DEFAULT
    sueldo_base = Decimal(str(sueldo_base))
    factor = _factor(regimen)

    if semestre == "Julio":
        ini_sem, fin_sem = date(anio, 1, 1), date(anio, 6, 30)
    else:  # Diciembre
        ini_sem, fin_sem = date(anio, 7, 1), date(anio, 12, 31)

    desde = max(fecha_ingreso, ini_sem)
    meses = meses_computables(desde, fin_sem, tope=6)

    grati_base = _r((sueldo_base / Decimal("6")) * meses * factor)
    tasa_essalud = Decimal(str(p.get(CLAVE_TASA_ESSALUD, Decimal("0.09"))))
    bonif_extraordinaria = _r(grati_base * tasa_essalud)
    total = _r(grati_base + bonif_extraordinaria)

    return {
        "tipo": "Gratificacion",
        "periodo": f"{semestre} {anio}",
        "meses_computables": meses,
        "remuneracion_computable": sueldo_base,
        "gratificacion_base": grati_base,
        "bonificacion_extraordinaria_9": bonif_extraordinaria,
        "regimen": regimen,
        "factor_regimen": factor,
        "monto": total,
    }


def calcular_cts(
    sueldo_base: Decimal,
    fecha_ingreso: date,
    periodo_cts: str,          # "Mayo" (nov-abr) | "Noviembre" (may-oct)
    anio: int,
    ultima_gratificacion: Decimal = Decimal("0"),
    regimen: str = "General",
) -> dict:
    """
    Depósito de CTS (mayo y noviembre).
    Remuneración computable = sueldo + 1/6 de la última gratificación.
    Depósito = (computable / 12) × meses del semestre.
    """
    sueldo_base = Decimal(str(sueldo_base))
    ultima_gratificacion = Decimal(str(ultima_gratificacion or 0))
    factor = _factor(regimen)

    if periodo_cts == "Mayo":
        ini_sem, fin_sem = date(anio - 1, 11, 1), date(anio, 4, 30)
    else:  # Noviembre
        ini_sem, fin_sem = date(anio, 5, 1), date(anio, 10, 31)

    computable = sueldo_base + _r(ultima_gratificacion / Decimal("6"))
    desde = max(fecha_ingreso, ini_sem)
    meses = meses_computables(desde, fin_sem, tope=6)

    deposito = _r((computable / Decimal("12")) * meses * factor)

    return {
        "tipo": "CTS",
        "periodo": f"{periodo_cts} {anio}",
        "meses_computables": meses,
        "remuneracion_computable": _r(computable),
        "un_sexto_gratificacion": _r(ultima_gratificacion / Decimal("6")),
        "regimen": regimen,
        "factor_regimen": factor,
        "monto": deposito,
    }


def calcular_liquidacion(
    sueldo_base: Decimal,
    fecha_ingreso: date,
    fecha_cese: date,
    dias_vacaciones_pendientes: int = 0,
    ultima_gratificacion: Decimal = Decimal("0"),
    regimen: str = "General",
    params: Optional[Dict[str, Decimal]] = None,
) -> dict:
    """
    Liquidación de beneficios sociales por cese. Suma los conceptos truncos:
      - Gratificación trunca del semestre en curso (+ bonif. 9 %).
      - CTS trunca desde el último depósito.
      - Vacaciones truncas (récord vacacional del año en curso).
      - Vacaciones pendientes de gozar (a razón de 1/30 de sueldo por día).
    """
    p = params or PARAMETROS_DEFAULT
    sueldo_base = Decimal(str(sueldo_base))
    factor = _factor(regimen)

    # 1) Gratificación trunca del semestre del cese.
    if fecha_cese.month <= 6:
        semestre, ini_sem, fin_sem = "Julio", date(fecha_cese.year, 1, 1), fecha_cese
    else:
        semestre, ini_sem, fin_sem = "Diciembre", date(fecha_cese.year, 7, 1), fecha_cese
    meses_grati = meses_computables(max(fecha_ingreso, ini_sem), fin_sem, tope=6)
    grati_base = _r((sueldo_base / Decimal("6")) * meses_grati * factor)
    tasa_essalud = Decimal(str(p.get(CLAVE_TASA_ESSALUD, Decimal("0.09"))))
    grati_trunca = _r(grati_base + grati_base * tasa_essalud)

    # 2) CTS trunca desde el inicio del semestre CTS en curso.
    if fecha_cese.month <= 4:
        ini_cts = date(fecha_cese.year - 1, 11, 1)
    elif fecha_cese.month <= 10:
        ini_cts = date(fecha_cese.year, 5, 1)
    else:
        ini_cts = date(fecha_cese.year, 11, 1)
    computable_cts = sueldo_base + _r(Decimal(str(ultima_gratificacion or 0)) / Decimal("6"))
    meses_cts = meses_computables(max(fecha_ingreso, ini_cts), fecha_cese, tope=6)
    cts_trunca = _r((computable_cts / Decimal("12")) * meses_cts * factor)

    # 3) Vacaciones truncas del año en curso (récord desde el aniversario).
    aniversario = date(fecha_cese.year, fecha_ingreso.month, min(fecha_ingreso.day, 28))
    if aniversario > fecha_cese:
        aniversario = date(fecha_cese.year - 1, fecha_ingreso.month, min(fecha_ingreso.day, 28))
    meses_vac = meses_computables(aniversario, fecha_cese, tope=12)
    vac_truncas = _r((sueldo_base / Decimal("12")) * meses_vac)

    # 4) Vacaciones pendientes de gozar (días ya ganados y no tomados).
    vac_pendientes = _r((sueldo_base / Decimal("30")) * Decimal(dias_vacaciones_pendientes))

    total = _r(grati_trunca + cts_trunca + vac_truncas + vac_pendientes)

    return {
        "tipo": "Liquidacion",
        "periodo": f"Cese {fecha_cese.isoformat()}",
        "meses_computables": None,
        "remuneracion_computable": sueldo_base,
        "gratificacion_trunca": grati_trunca,
        "cts_trunca": cts_trunca,
        "vacaciones_truncas": vac_truncas,
        "vacaciones_pendientes": vac_pendientes,
        "dias_vacaciones_pendientes": dias_vacaciones_pendientes,
        "regimen": regimen,
        "factor_regimen": factor,
        "monto": total,
    }


# ==========================================================================
# Vacaciones: saldo legal de 30 días por año trabajado.
# ==========================================================================

def saldo_vacaciones(fecha_ingreso: date, dias_gozados: int, hasta: Optional[date] = None) -> dict:
    """
    Saldo de vacaciones: 30 días ganados por año completo trabajado (2.5 por mes),
    menos los días ya gozados/programados. Base para el portal de autogestión.
    """
    hasta = hasta or date.today()
    meses = meses_computables(fecha_ingreso, hasta, tope=600)  # sin tope real de semestre/año
    dias_ganados = int((Decimal("2.5") * meses).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    saldo = dias_ganados - dias_gozados
    return {
        "dias_ganados": dias_ganados,
        "dias_gozados": dias_gozados,
        "dias_disponibles": max(0, saldo),
    }
