from datetime import date
from typing import Optional

DIAS_POR_MES = 2.5  # 30 días / 12 meses (D.L. 713)


def dias_devengados(fecha_ingreso: Optional[date], hasta: date) -> int:
    """
    Días de descanso vacacional devengados por mes completo de servicio.
    Se reutiliza tanto para el saldo vacacional en curso (vacaciones_router)
    como para las vacaciones truncas al momento del cese (liquidacion_router).
    """
    if not fecha_ingreso or hasta < fecha_ingreso:
        return 0
    meses = (hasta.year - fecha_ingreso.year) * 12 + (hasta.month - fecha_ingreso.month)
    if hasta.day < fecha_ingreso.day:
        meses -= 1
    return int(max(0, meses) * DIAS_POR_MES)
