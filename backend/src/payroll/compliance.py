"""
Fase 2 — Auditoría normativa de la pre-nómina (motor de reglas determinista).

Detecta bloqueos legales sobre los detalles ya consolidados (p. ej. sueldos por
debajo de la RMV del sector) y los persiste como `AlertaNormativa`. Un hallazgo de
nivel 'bloqueo' impide que la nómina pase a 'Aprobado'.

Es DETERMINISTA a propósito: el cumplimiento legal no puede depender de un modelo
probabilístico. El LLM (Copiloto, Fase 4) se limita a explicar estos hallazgos.
"""
from decimal import Decimal
from typing import List, Dict

from sqlalchemy.orm import Session

from src.core.models import DetalleNomina, AlertaNormativa, Nomina, Usuario, Empresa
from src.hr.models import Empleado
from src.core.fiscal import cargar_parametros_fiscales, config_sector

NIVEL_BLOQUEO = "bloqueo"
NIVEL_ADVERTENCIA = "advertencia"


def _nombre_empleado(db: Session, detalle: DetalleNomina) -> str:
    emp = db.query(Empleado).filter(Empleado.usuario_id == detalle.usuario_id).first()
    if emp and emp.nombre:
        return emp.nombre
    u = db.query(Usuario).filter(Usuario.usuario_id == detalle.usuario_id).first()
    return u.nombre if u else f"Usuario {detalle.usuario_id}"


def _empleado_id(db: Session, detalle: DetalleNomina):
    emp = db.query(Empleado).filter(Empleado.usuario_id == detalle.usuario_id).first()
    return emp.empleado_id if emp else None


def auditar_prenomina(db: Session, nomina: Nomina) -> List[Dict]:
    """
    Recalcula las alertas de una nómina a partir de sus detalles consolidados.
    Borra las alertas previas de esa nómina y persiste las nuevas. Devuelve la
    lista de alertas como dicts.
    """
    params = cargar_parametros_fiscales(db)
    empresa = db.query(Empresa).filter(Empresa.empresa_id == nomina.empresa_id).first()
    regimen = empresa.regimen_laboral if empresa else "General"

    detalles = db.query(DetalleNomina).filter(
        DetalleNomina.nomina_id == nomina.id,
        DetalleNomina.is_deleted.is_(False),
    ).all()

    # Regenerar: eliminar hallazgos previos de esta nómina.
    db.query(AlertaNormativa).filter(AlertaNormativa.nomina_id == nomina.id).delete()

    alertas: List[AlertaNormativa] = []

    for d in detalles:
        nombre = _nombre_empleado(db, d)
        emp_id = _empleado_id(db, d)
        perfil = d.perfil_contrato or "Comun"
        cfg = config_sector(perfil)
        sueldo_base = Decimal(str(d.sueldo_base or 0))

        # Regla 1: sueldo base por debajo de la RMV del sector (bloqueo).
        if cfg["piso_rmv"]:
            piso = Decimal(str(params.get(cfg["clave_rmv"], 0)))
            if sueldo_base < piso:
                etiqueta = "RMV minera" if perfil == "Minero" else ("RMV agraria" if perfil == "Agrario" else "RMV")
                alertas.append(AlertaNormativa(
                    nomina_id=nomina.id, empleado_id=emp_id, nivel=NIVEL_BLOQUEO,
                    concepto="Remuneración por debajo del mínimo legal",
                    mensaje=f"{nombre}: sueldo base S/ {sueldo_base} es menor a la {etiqueta} vigente (S/ {piso}).",
                    explicacion=(
                        f"El perfil '{perfil}' exige una remuneración mínima de S/ {piso}. "
                        f"Ajusta el contrato a al menos ese monto antes de aprobar la planilla."
                    ),
                ))

        # Regla 2: falta el bono inamovible del sector (advertencia).
        if cfg["clave_bono"] and Decimal(str(d.bonos_sector or 0)) <= 0:
            alertas.append(AlertaNormativa(
                nomina_id=nomina.id, empleado_id=emp_id, nivel=NIVEL_ADVERTENCIA,
                concepto="Bono inamovible del sector en cero",
                mensaje=f"{nombre}: no se aplicó el {cfg['bono_nombre']}.",
                explicacion=(
                    f"El perfil '{perfil}' contempla el {cfg['bono_nombre']} como concepto inamovible. "
                    f"Verifica el parámetro '{cfg['clave_bono']}' en el panel fiscal."
                ),
            ))

        # Regla 3: neto no positivo (advertencia).
        if Decimal(str(d.sueldo_neto or 0)) <= 0:
            alertas.append(AlertaNormativa(
                nomina_id=nomina.id, empleado_id=emp_id, nivel=NIVEL_ADVERTENCIA,
                concepto="Sueldo neto no positivo",
                mensaje=f"{nombre}: el neto a pagar es S/ {Decimal(str(d.sueldo_neto or 0))}.",
                explicacion="Los descuentos igualan o superan los ingresos. Revisa inasistencias y adelantos.",
            ))

    for a in alertas:
        db.add(a)
    db.commit()

    return [
        {
            "id": a.id,
            "empleado_id": a.empleado_id,
            "nivel": a.nivel,
            "concepto": a.concepto,
            "mensaje": a.mensaje,
            "explicacion": a.explicacion,
        }
        for a in alertas
    ]


def contar_bloqueos(db: Session, nomina_id: int) -> int:
    return db.query(AlertaNormativa).filter(
        AlertaNormativa.nomina_id == nomina_id,
        AlertaNormativa.nivel == NIVEL_BLOQUEO,
    ).count()
