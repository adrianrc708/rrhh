"""
Fase 7 — Auditoría técnica global. Consulta reservada al SuperAdmin.
"""
import re
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db, SessionLocal
from src.core.models import Usuario
from src.core.dependencies import verificar_rol
from src.infrastructure.models import LogTecnico

router = APIRouter()

# Patrones groseros de inyección SQL / XSS / traversal para señalizar (no bloquean).
_PATRONES_SOSPECHOSOS = re.compile(
    r"(union\s+select|--\s|;\s*drop\s+table|<script|onerror\s*=|\.\./|/etc/passwd|xp_cmdshell)",
    re.IGNORECASE,
)


def detectar_sospecha(ruta: str) -> bool:
    return bool(_PATRONES_SOSPECHOSOS.search(ruta or ""))


def registrar_log_tecnico(nivel: str, metodo: str, ruta: str, status_code: Optional[int],
                          mensaje: str, ip: Optional[str], empresa_id: Optional[int] = None,
                          usuario_id: Optional[int] = None) -> None:
    """
    Escribe un log técnico usando su propia sesión (se llama desde middleware, fuera
    del ciclo de dependencias). Nunca propaga errores para no afectar la respuesta.
    """
    db = SessionLocal()
    try:
        db.add(LogTecnico(
            nivel=nivel, metodo=metodo, ruta=ruta[:300] if ruta else None,
            status_code=status_code, mensaje=(mensaje or "")[:2000], ip=ip,
            empresa_id=empresa_id, usuario_id=usuario_id,
        ))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@router.get("/logs")
def listar_logs_tecnicos(
    nivel: Optional[str] = None,
    limite: int = 200,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"])),
):
    q = db.query(LogTecnico)
    if nivel:
        q = q.filter(LogTecnico.nivel == nivel)
    filas = q.order_by(LogTecnico.fecha_evento.desc()).limit(min(limite, 1000)).all()
    return [
        {
            "id": l.id, "nivel": l.nivel, "empresa_id": l.empresa_id,
            "metodo": l.metodo, "ruta": l.ruta, "status_code": l.status_code,
            "mensaje": l.mensaje, "ip": l.ip, "fecha_evento": l.fecha_evento,
        } for l in filas
    ]
