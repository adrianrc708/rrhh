"""
Fase 3 — Segmentación horaria automática desde marcaciones.

Empareja entrada/salida, calcula horas trabajadas y las clasifica en ordinarias,
nocturnas (22:00–06:00), sobretiempo 25% (primeras 2h) y 35% (resto), respetando
los días de descanso de una jornada atípica (CicloJornada). El resultado alimenta
`HorasPeriodo` (Fase 2) al congelar el mes.
"""
from datetime import datetime, timedelta, time, date
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from src.attendance.models import Marcacion, CicloJornada
from src.hr.models import Empleado

# Jornada ordinaria diaria (horas). Lo que exceda se paga como sobretiempo.
JORNADA_DIARIA = Decimal("8")
HORAS_EXTRA_A_25 = Decimal("2")   # primeras 2 horas de sobretiempo al 25%


def es_dia_descanso_programado(ciclo: CicloJornada, fecha: date) -> bool:
    """True si `fecha` cae en la parte de descanso del ciclo (ej. 14x7)."""
    if not ciclo or fecha < ciclo.fecha_inicio_ciclo:
        return False
    largo = (ciclo.dias_trabajo or 0) + (ciclo.dias_descanso or 0)
    if largo <= 0:
        return False
    pos = (fecha - ciclo.fecha_inicio_ciclo).days % largo
    return pos >= ciclo.dias_trabajo


def _segundos_nocturnos(a: datetime, b: datetime) -> float:
    """Segundos del intervalo [a, b) que caen en la franja nocturna 22:00–06:00."""
    total = 0.0
    cur = a
    while cur < b:
        dia = cur.date()
        fin_dia = datetime.combine(dia + timedelta(days=1), time.min)
        seg_fin = min(b, fin_dia)
        for h1, h2 in ((0, 6), (22, 24)):
            w_start = datetime.combine(dia, time.min) + timedelta(hours=h1)
            w_end = datetime.combine(dia, time.min) + timedelta(hours=h2)
            ov = (min(seg_fin, w_end) - max(cur, w_start)).total_seconds()
            if ov > 0:
                total += ov
        cur = seg_fin
    return total


def _emparejar(marcaciones: List[Marcacion]):
    """Genera pares (entrada, salida) a partir de marcaciones ordenadas por momento."""
    pendiente = None
    for m in marcaciones:
        if m.tipo == "entrada":
            pendiente = m
        elif m.tipo == "salida" and pendiente is not None:
            yield pendiente.momento, m.momento
            pendiente = None


def _segmentar_empleado(marcaciones: List[Marcacion], ciclo: Optional[CicloJornada]) -> dict:
    segundos_por_dia: Dict[date, float] = {}
    segundos_nocturnos = 0.0

    for entrada, salida in _emparejar(marcaciones):
        dur = (salida - entrada).total_seconds()
        if dur <= 0 or dur > 16 * 3600:
            continue  # dato inconsistente
        dia = entrada.date()
        segundos_por_dia[dia] = segundos_por_dia.get(dia, 0.0) + dur
        segundos_nocturnos += _segundos_nocturnos(entrada, salida)

    he25 = Decimal("0")
    he35 = Decimal("0")
    horas_totales = Decimal("0")
    dias_trabajados = 0

    for dia, seg in segundos_por_dia.items():
        horas = Decimal(str(round(seg / 3600, 4)))
        if horas <= 0:
            continue
        dias_trabajados += 1
        horas_totales += horas

        descanso = ciclo is not None and es_dia_descanso_programado(ciclo, dia)
        if descanso:
            extra = horas  # todo el trabajo en día de descanso es sobretiempo
        else:
            extra = max(Decimal("0"), horas - JORNADA_DIARIA)

        if extra > 0:
            he25 += min(extra, HORAS_EXTRA_A_25)
            if extra > HORAS_EXTRA_A_25:
                he35 += extra - HORAS_EXTRA_A_25

    q = Decimal("0.01")
    return {
        "dias_trabajados": dias_trabajados,
        "horas_totales": horas_totales.quantize(q),
        "horas_extra_25": he25.quantize(q),
        "horas_extra_35": he35.quantize(q),
        "horas_nocturnas": Decimal(str(round(segundos_nocturnos / 3600, 2))).quantize(q),
    }


def conciliar_periodo(db: Session, empresa_id: int, periodo: str) -> List[dict]:
    """
    Calcula la segmentación de horas de todos los empleados activos de la empresa
    para el periodo (YYYY-MM), a partir de sus marcaciones.
    """
    empleados = db.query(Empleado).filter(
        Empleado.empresa_id == empresa_id,
        Empleado.estado == "Activo",
        Empleado.is_deleted.is_(False),
    ).all()

    salida: List[dict] = []
    for emp in empleados:
        marcaciones = db.query(Marcacion).filter(
            Marcacion.empleado_id == emp.empleado_id,
            Marcacion.periodo == periodo,
            Marcacion.is_deleted.is_(False),
        ).order_by(Marcacion.momento.asc()).all()

        ciclo = db.query(CicloJornada).filter(
            CicloJornada.empleado_id == emp.empleado_id,
            CicloJornada.activo.is_(True),
            CicloJornada.is_deleted.is_(False),
        ).first()

        seg = _segmentar_empleado(marcaciones, ciclo)
        seg.update({
            "empleado_id": emp.empleado_id,
            "nombre": emp.nombre or f"Empleado {emp.empleado_id}",
            "marcaciones": len(marcaciones),
            "jornada_ciclica": ciclo.nombre if ciclo else None,
        })
        salida.append(seg)

    return salida
