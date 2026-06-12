from sqlalchemy.orm import Session
from src.core.models import EventoAuditoria, DetalleNomina
import json

def calcular_sueldo_neto(sueldo_base: float, haberes: float, descuentos: float) -> float:
    return (sueldo_base + haberes) - descuentos

def procesar_detalle_nomina(db: Session, nomina_id: int, empleado_id: int, base: float, hab: float, desc: float):
    neto = calcular_sueldo_neto(base, hab, desc)
    nuevo_detalle = DetalleNomina(
        nomina_id=nomina_id,
        usuario_id=empleado_id,
        sueldo_base=base,
        haberes=hab,
        descuentos=desc,
        sueldo_neto=neto
    )
    db.add(nuevo_detalle)
    return nuevo_detalle

def registrar_auditoria(db: Session, usuario_id: int, accion: str, modulo: str, detalles: dict = None):
    detalles_str = json.dumps(detalles) if detalles else None
    nuevo_evento = EventoAuditoria(
        usuario_id=usuario_id,
        accion=accion,
        modulo=modulo,
        detalles=detalles_str
    )
    db.add(nuevo_evento)
    db.commit()