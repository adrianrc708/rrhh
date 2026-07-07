"""
Fase 3 — Utilidades biométricas y de credenciales de dispositivo.

El reconocimiento facial se calcula en el navegador (face-api.js): el cliente envía
un descriptor de 128 dimensiones. Aquí solo hacemos el *matching* por distancia
euclidiana contra los rostros enrolados de la empresa. También se generan/validan
los tokens de los dispositivos kiosco.
"""
import json
import math
import secrets
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from src.attendance.models import RostroEmpleado, DispositivoKiosco
from src.core.security import obtener_password_hash, verificar_password

# Umbral de distancia para aceptar una coincidencia facial. face-api.js recomienda
# ~0.6; usamos 0.5 para reducir falsos positivos en el control de asistencia.
UMBRAL_MATCH = 0.5
DIM_DESCRIPTOR = 128


def _distancia_euclidiana(a: List[float], b: List[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def validar_descriptor(descriptor) -> List[float]:
    """Valida que el descriptor sea una lista de 128 números."""
    if not isinstance(descriptor, list) or len(descriptor) != DIM_DESCRIPTOR:
        raise ValueError(f"El descriptor facial debe tener {DIM_DESCRIPTOR} dimensiones.")
    try:
        return [float(x) for x in descriptor]
    except (TypeError, ValueError):
        raise ValueError("El descriptor facial contiene valores no numéricos.")


def match_descriptor(
    db: Session, empresa_id: int, descriptor: List[float]
) -> Tuple[Optional[int], float]:
    """
    Devuelve (empleado_id, distancia) del rostro enrolado más cercano dentro del
    umbral. Si nadie califica, devuelve (None, mejor_distancia).
    """
    rostros = db.query(RostroEmpleado).filter(
        RostroEmpleado.empresa_id == empresa_id,
        RostroEmpleado.activo.is_(True),
        RostroEmpleado.is_deleted.is_(False),
    ).all()

    mejor_id: Optional[int] = None
    mejor_dist = float("inf")
    for r in rostros:
        try:
            emb = json.loads(r.descriptor)
        except Exception:
            continue
        if len(emb) != DIM_DESCRIPTOR:
            continue
        d = _distancia_euclidiana(descriptor, emb)
        if d < mejor_dist:
            mejor_dist = d
            mejor_id = r.empleado_id

    if mejor_id is not None and mejor_dist <= UMBRAL_MATCH:
        return mejor_id, mejor_dist
    return None, mejor_dist


# ── Credenciales de dispositivo kiosco ────────────────────────────────────────

def generar_secreto_dispositivo() -> str:
    """Secreto aleatorio para el token del dispositivo (parte no reversible)."""
    return secrets.token_urlsafe(24)


def construir_token(dispositivo_id: int, secreto: str) -> str:
    """Token que se entrega a la tablet: '<id>.<secreto>'."""
    return f"{dispositivo_id}.{secreto}"


def parsear_token(token: str) -> Tuple[Optional[int], Optional[str]]:
    if not token or "." not in token:
        return None, None
    id_str, _, secreto = token.partition(".")
    if not id_str.isdigit():
        return None, None
    return int(id_str), secreto


def hash_secreto(valor: str) -> str:
    return obtener_password_hash(valor)


def verificar_secreto(valor: str, valor_hash: str) -> bool:
    try:
        return verificar_password(valor, valor_hash)
    except Exception:
        return False
