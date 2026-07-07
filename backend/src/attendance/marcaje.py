"""Fase 3 — Registro de marcaciones (compartido entre kiosco y marcación remota)."""
from datetime import datetime, date
from typing import Optional

from sqlalchemy.orm import Session

from src.attendance.models import Marcacion


def determinar_tipo(db: Session, empleado_id: int, fecha: date) -> str:
    """Alterna entrada/salida según la última marcación del empleado ese día."""
    ultima = db.query(Marcacion).filter(
        Marcacion.empleado_id == empleado_id,
        Marcacion.fecha == fecha,
        Marcacion.is_deleted.is_(False),
    ).order_by(Marcacion.momento.desc()).first()
    if ultima and ultima.tipo == "entrada":
        return "salida"
    return "entrada"


def registrar_marcacion(
    db: Session,
    empresa_id: int,
    empleado_id: int,
    origen: str,
    dispositivo_id: Optional[int] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    ip: Optional[str] = None,
    distancia: Optional[float] = None,
) -> Marcacion:
    ahora = datetime.now()
    tipo = determinar_tipo(db, empleado_id, ahora.date())
    marcacion = Marcacion(
        empresa_id=empresa_id,
        empleado_id=empleado_id,
        tipo=tipo,
        momento=ahora,
        fecha=ahora.date(),
        periodo=ahora.strftime("%Y-%m"),
        origen=origen,
        dispositivo_id=dispositivo_id,
        lat=lat,
        lng=lng,
        ip=ip,
        distancia_match=distancia,
    )
    db.add(marcacion)
    db.commit()
    db.refresh(marcacion)
    return marcacion
