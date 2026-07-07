"""
Fase 3 — Router del Kiosco Facial (interfaz aislada para tablets).

Se autentica con el token del dispositivo (header X-Device-Token), NO con una
sesión de usuario, para no exponer credenciales administrativas en el kiosco.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.attendance.models import DispositivoKiosco
from src.attendance.schemas import KioscoVerificar, MarcarKiosco, MarcacionKioscoResultado
from src.attendance import biometrics
from src.attendance.marcaje import registrar_marcacion
from src.hr.models import Empleado

router = APIRouter()


def _buscar_dispositivo(db: Session, token: str) -> DispositivoKiosco:
    dispositivo_id, secreto = biometrics.parsear_token(token)
    if dispositivo_id is None or not secreto:
        raise HTTPException(status_code=401, detail="Token de dispositivo inválido")
    dispositivo = db.query(DispositivoKiosco).filter(
        DispositivoKiosco.dispositivo_id == dispositivo_id,
        DispositivoKiosco.activo.is_(True),
        DispositivoKiosco.is_deleted.is_(False),
    ).first()
    if not dispositivo or not biometrics.verificar_secreto(secreto, dispositivo.token_hash):
        raise HTTPException(status_code=401, detail="Dispositivo no autorizado")
    return dispositivo


def dispositivo_actual(
    x_device_token: str = Header(None, alias="X-Device-Token"),
    db: Session = Depends(get_db),
) -> DispositivoKiosco:
    if not x_device_token:
        raise HTTPException(status_code=401, detail="Falta el token del dispositivo")
    return _buscar_dispositivo(db, x_device_token)


@router.post("/verificar")
def verificar_dispositivo(datos: KioscoVerificar, db: Session = Depends(get_db)):
    """Provisionamiento de la tablet: valida token + PIN una sola vez."""
    dispositivo = _buscar_dispositivo(db, datos.token)
    if not biometrics.verificar_secreto(datos.pin, dispositivo.pin_hash):
        raise HTTPException(status_code=401, detail="PIN incorrecto")
    dispositivo.ultimo_uso = datetime.now()
    db.commit()
    return {"ok": True, "empresa_id": dispositivo.empresa_id, "nombre": dispositivo.nombre}


@router.post("/marcar", response_model=MarcacionKioscoResultado)
def marcar(
    datos: MarcarKiosco,
    db: Session = Depends(get_db),
    dispositivo: DispositivoKiosco = Depends(dispositivo_actual),
):
    """Reconoce el rostro y registra la marcación (alterna entrada/salida)."""
    try:
        descriptor = biometrics.validar_descriptor(datos.descriptor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    empleado_id, distancia = biometrics.match_descriptor(db, dispositivo.empresa_id, descriptor)
    if empleado_id is None:
        raise HTTPException(status_code=404, detail="Rostro no reconocido. Acércate e intenta de nuevo.")

    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == empleado_id,
        Empleado.estado == "Activo",
        Empleado.is_deleted.is_(False),
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="El empleado reconocido no está activo.")

    marcacion = registrar_marcacion(
        db,
        empresa_id=dispositivo.empresa_id,
        empleado_id=empleado_id,
        origen="kiosco",
        dispositivo_id=dispositivo.dispositivo_id,
        lat=datos.lat,
        lng=datos.lng,
        distancia=round(distancia, 4),
    )
    dispositivo.ultimo_uso = datetime.now()
    db.commit()

    return MarcacionKioscoResultado(
        empleado_id=empleado_id,
        nombre=empleado.nombre or f"Empleado {empleado_id}",
        tipo=marcacion.tipo,
        momento=marcacion.momento,
        distancia=round(distancia, 4),
    )
