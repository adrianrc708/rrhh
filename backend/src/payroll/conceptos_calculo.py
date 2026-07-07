from decimal import Decimal
from typing import List


def calcular_aplicacion_periodo(conceptos: List, periodo: str) -> dict:
    """
    Dado el conjunto de ConceptoVariable activos de un empleado y el periodo
    (YYYY-MM) de la nómina que se está consolidando, calcula:
      - comision: comisiones a abonar como haber en ESTE periodo.
      - descuento_prestamos: cuota de adelantos/préstamos a descontar en ESTE
        periodo (monto/cuotas), determinada por la distancia de meses entre
        el periodo en que se otorgó el concepto y el periodo actual — mismo
        criterio "sin tabla de aplicaciones aparte" que HorasPeriodo.
    """
    anio_p, mes_p = (int(x) for x in periodo.split("-"))
    comision = Decimal("0")
    descuento_prestamos = Decimal("0")

    for c in conceptos:
        if c.estado != "Activo":
            continue
        if c.tipo == "Comision":
            if c.periodo == periodo:
                comision += Decimal(str(c.monto))
            continue

        # Adelanto | Prestamo: se descuentan en `cuotas` planillas consecutivas
        # a partir del periodo en que se otorgaron (índice 0 = ese mismo mes).
        anio_c, mes_c = (int(x) for x in c.periodo.split("-"))
        indice = (anio_p - anio_c) * 12 + (mes_p - mes_c)
        if 0 <= indice < c.cuotas:
            descuento_prestamos += (Decimal(str(c.monto)) / c.cuotas).quantize(Decimal("0.01"))

    return {"comision": comision, "descuento_prestamos": descuento_prestamos}
