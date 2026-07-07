"""
Fase 1 — Parámetros fiscales/macro versionados.

Centraliza las variables macroeconómicas (RMV, UIT, tasas de pensión y EsSalud)
que antes estaban hardcodeadas en `payroll/calculations.py`. Ahora viven en la
tabla `parametros_fiscales`, con vigencia por fecha, y el SuperAdmin las mantiene
desde su panel. El motor de cálculo lee estos valores en cada consolidación.

Si la tabla está vacía (BD recién creada o migración aún no seedeada), se usa
`PARAMETROS_DEFAULT` como fallback para no romper los cálculos existentes.
"""
from __future__ import annotations

from decimal import Decimal
from datetime import date
from typing import Dict, Optional

from sqlalchemy.orm import Session

from src.core.models import ParametroFiscal


# Claves canónicas usadas por el motor de cálculo. Cualquier consumidor debe
# referirse a estas constantes en vez de literales sueltos.
CLAVE_RMV = "RMV"
CLAVE_UIT = "UIT"
CLAVE_TASA_ONP = "TASA_ONP"
CLAVE_TASA_AFP_APORTE = "TASA_AFP_APORTE"
CLAVE_TASA_AFP_PRIMA = "TASA_AFP_PRIMA_SEGURO"
CLAVE_TASA_AFP_COMISION = "TASA_AFP_COMISION_FLUJO"
CLAVE_TASA_ESSALUD = "TASA_ESSALUD"

# Fase 2 — Mínimos y bonos inamovibles por sector (también versionados).
CLAVE_RMV_MINERA = "RMV_MINERA"
CLAVE_RMV_AGRARIO = "RMV_AGRARIO"
CLAVE_BONO_MINERO_RIESGO = "BONO_MINERO_RIESGO"
CLAVE_BONO_BETA_AGRARIO = "BONO_BETA_AGRARIO"


# Valores de referencia (Perú 2024). Sirven como semilla y como fallback.
PARAMETROS_DEFAULT: Dict[str, Decimal] = {
    CLAVE_RMV: Decimal("1025"),
    CLAVE_UIT: Decimal("5150"),
    CLAVE_TASA_ONP: Decimal("0.13"),
    CLAVE_TASA_AFP_APORTE: Decimal("0.10"),
    CLAVE_TASA_AFP_PRIMA: Decimal("0.0174"),
    CLAVE_TASA_AFP_COMISION: Decimal("0.0069"),
    CLAVE_TASA_ESSALUD: Decimal("0.09"),
    # Sectoriales: la RMV minera es la RMV + 25%; los bonos son referenciales y
    # el SuperAdmin los ajusta desde el panel de parámetros.
    CLAVE_RMV_MINERA: Decimal("1281.25"),
    CLAVE_RMV_AGRARIO: Decimal("1025"),
    CLAVE_BONO_MINERO_RIESGO: Decimal("256.25"),
    CLAVE_BONO_BETA_AGRARIO: Decimal("307.50"),
}

# Descripciones legibles para el panel de mantenimiento.
DESCRIPCIONES: Dict[str, str] = {
    CLAVE_RMV: "Remuneración Mínima Vital",
    CLAVE_UIT: "Unidad Impositiva Tributaria",
    CLAVE_TASA_ONP: "Aporte ONP (Sistema Nacional de Pensiones)",
    CLAVE_TASA_AFP_APORTE: "Aporte obligatorio AFP",
    CLAVE_TASA_AFP_PRIMA: "Prima de seguro AFP",
    CLAVE_TASA_AFP_COMISION: "Comisión sobre flujo AFP",
    CLAVE_TASA_ESSALUD: "Aporte EsSalud (empleador)",
    CLAVE_RMV_MINERA: "Remuneración mínima sector minero",
    CLAVE_RMV_AGRARIO: "Remuneración mínima régimen agrario",
    CLAVE_BONO_MINERO_RIESGO: "Bono por riesgo (minero, inamovible)",
    CLAVE_BONO_BETA_AGRARIO: "Bono BETA (agrario, inamovible)",
}


# Perfiles de contrato válidos (Fase 2).
PERFILES_CONTRATO = ["Comun", "Minero", "Agrario", "Construccion", "PartTime"]

# Regímenes laborales de empresa válidos (Fase 2).
REGIMENES_LABORALES = ["General", "MYPE_Pequena", "MYPE_Micro"]

# Configuración por perfil: qué RMV aplica como piso, qué bono inamovible
# corresponde y su etiqueta. `piso_rmv=False` => sin piso de RMV mensual fijo
# (p. ej. Part-time, que es proporcional a las horas).
SECTOR_CONFIG: Dict[str, dict] = {
    "Comun":        {"clave_rmv": CLAVE_RMV,         "clave_bono": None,                      "bono_nombre": None,                  "piso_rmv": True},
    "Minero":       {"clave_rmv": CLAVE_RMV_MINERA,  "clave_bono": CLAVE_BONO_MINERO_RIESGO,  "bono_nombre": "Bono riesgo minero",  "piso_rmv": True},
    "Agrario":      {"clave_rmv": CLAVE_RMV_AGRARIO, "clave_bono": CLAVE_BONO_BETA_AGRARIO,   "bono_nombre": "Bono BETA agrario",   "piso_rmv": True},
    "Construccion": {"clave_rmv": CLAVE_RMV,         "clave_bono": None,                      "bono_nombre": None,                  "piso_rmv": True},
    "PartTime":     {"clave_rmv": CLAVE_RMV,         "clave_bono": None,                      "bono_nombre": None,                  "piso_rmv": False},
}


def config_sector(perfil: Optional[str]) -> dict:
    """Devuelve la configuración sectorial del perfil (o la del perfil Común)."""
    return SECTOR_CONFIG.get(perfil or "Comun", SECTOR_CONFIG["Comun"])


def cargar_parametros_fiscales(db: Session, fecha: Optional[date] = None) -> Dict[str, Decimal]:
    """
    Devuelve un dict {clave: valor Decimal} con los parámetros vigentes en `fecha`
    (por defecto hoy). Parte de PARAMETROS_DEFAULT y sobreescribe con lo que haya
    en BD, tomando siempre la vigencia más reciente que aplique a la fecha.
    """
    fecha = fecha or date.today()
    valores: Dict[str, Decimal] = dict(PARAMETROS_DEFAULT)

    filas = (
        db.query(ParametroFiscal)
        .filter(
            ParametroFiscal.activo.is_(True),
            ParametroFiscal.vigencia_desde <= fecha,
        )
        .order_by(ParametroFiscal.vigencia_desde.asc())
        .all()
    )

    for fila in filas:
        if fila.vigencia_hasta is not None and fila.vigencia_hasta < fecha:
            continue  # vigencia ya cerrada antes de la fecha consultada
        # Como están ordenadas ascendentemente, la última que aplica gana.
        valores[fila.clave] = Decimal(str(fila.valor))

    return valores


def obtener_parametro(db: Session, clave: str, fecha: Optional[date] = None) -> Decimal:
    """Atajo para leer un único parámetro vigente."""
    return cargar_parametros_fiscales(db, fecha).get(clave, PARAMETROS_DEFAULT.get(clave, Decimal("0")))
