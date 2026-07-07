"""
Fase 4 — Copiloto de IA (chat en lenguaje natural, acotado por rol).

El contexto que recibe el LLM se construye EN EL SERVIDOR limitado al alcance del
usuario (`alcance_empleados`): Admin/RRHH ven toda la empresa, el Gerente solo su
subárbol (se "inyecta el parent_id por detrás"), el Empleado solo lo suyo. El
modelo nunca ve datos fuera de ese alcance.
"""
from datetime import date
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.models import Usuario, Nomina, AlertaNormativa
from src.core.dependencies import verificar_rol, alcance_empleados
from src.core.services import registrar_auditoria
from src.hr.models import Empleado, Contrato
from src.attendance.models import Inasistencia
from src.ai import llm

router = APIRouter()


class ChatMensaje(BaseModel):
    role: str
    content: str


class CopilotoRequest(BaseModel):
    messages: List[ChatMensaje] = []


def _construir_contexto(db: Session, usuario: Usuario) -> str:
    """Arma el contexto de datos limitado al alcance del usuario."""
    scope = alcance_empleados(db, usuario)

    q = db.query(Empleado).filter(
        Empleado.empresa_id == usuario.empresa_id,
        Empleado.is_deleted.is_(False),
    )
    if scope is not None:
        q = q.filter(Empleado.empleado_id.in_(scope or {-1}))
    empleados = q.limit(200).all()
    ids = [e.empleado_id for e in empleados]
    nombre_por_id = {e.empleado_id: (e.nombre or f"Empleado {e.empleado_id}") for e in empleados}

    lineas = [f"Alcance del usuario: {'toda la empresa' if scope is None else f'{len(ids)} colaboradores de su equipo'}."]

    lineas.append("\n## Colaboradores")
    for e in empleados:
        cargo = e.cargo_rel.nombre if e.cargo_rel else "—"
        area = e.departamento_rel.nombre if e.departamento_rel else "—"
        lineas.append(f"- {nombre_por_id[e.empleado_id]} | Cargo: {cargo} | Área: {area} | Estado: {e.estado}")

    if ids:
        contratos = db.query(Contrato).filter(
            Contrato.empleado_id.in_(ids),
            Contrato.estado == "Vigente",
            Contrato.is_deleted.is_(False),
        ).all()
        if contratos:
            lineas.append("\n## Contratos vigentes")
            for c in contratos:
                lineas.append(
                    f"- {nombre_por_id.get(c.empleado_id, c.empleado_id)}: sueldo S/ {c.sueldo_base}, "
                    f"{c.tipo_contrato} / perfil {c.perfil_contrato}"
                )

        periodo_actual = date.today().strftime("%Y-%m")
        inas = db.query(Inasistencia).filter(
            Inasistencia.empleado_id.in_(ids),
            Inasistencia.periodo == periodo_actual,
        ).all()
        if inas:
            por_emp = {}
            for i in inas:
                por_emp[i.empleado_id] = por_emp.get(i.empleado_id, 0) + 1
            lineas.append(f"\n## Inasistencias del periodo {periodo_actual}")
            for eid, n in por_emp.items():
                lineas.append(f"- {nombre_por_id.get(eid, eid)}: {n} inasistencia(s)")

    # Nóminas recientes de la empresa
    nominas = db.query(Nomina).filter(
        Nomina.empresa_id == usuario.empresa_id,
        Nomina.is_deleted.is_(False),
    ).order_by(Nomina.periodo.desc()).limit(6).all()
    if nominas:
        lineas.append("\n## Nóminas recientes")
        for n in nominas:
            lineas.append(f"- {n.periodo}: estado {n.estado}, neto S/ {n.total_neto}")

    # Alertas normativas (para explicar bloqueos)
    aq = db.query(AlertaNormativa).join(Nomina, AlertaNormativa.nomina_id == Nomina.id).filter(
        Nomina.empresa_id == usuario.empresa_id,
    )
    if scope is not None:
        aq = aq.filter(AlertaNormativa.empleado_id.in_(scope or {-1}))
    alertas = aq.order_by(AlertaNormativa.id.desc()).limit(20).all()
    if alertas:
        lineas.append("\n## Alertas normativas (auditoría de nómina)")
        for a in alertas:
            lineas.append(f"- [{a.nivel}] {a.concepto}: {a.mensaje}")

    return "\n".join(lineas)


@router.post("/copiloto")
def copiloto(
    datos: CopilotoRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    contexto = _construir_contexto(db, usuario_actual)
    system_prompt = f"""
Eres el Copiloto de RRHH de una plataforma peruana de gestión de personal.
Rol del usuario: {usuario_actual.rol}.

IMPORTANTE: solo puedes usar la información del siguiente contexto, que YA fue
filtrado según los permisos del usuario. No inventes datos ni te refieras a
personas o cifras que no aparezcan aquí. Si te preguntan algo fuera del contexto,
acláralo.

{contexto}

Responde en español, en Markdown, de forma concisa y profesional. Cuando te
pregunten por bloqueos o alertas normativas, explica el motivo legal en lenguaje claro.
""".strip()

    mensajes = [{"role": m.role, "content": m.content} for m in datos.messages]
    respuesta = llm.responder(
        system_prompt,
        mensajes,
        prompt_inicial="Dame un resumen ejecutivo de la situación de mi equipo/empresa.",
    )

    registrar_auditoria(db, usuario_actual.usuario_id, "USAR_COPILOTO_IA", "IA",
                        {"mensajes": len(mensajes)})
    return {"respuesta": respuesta}
