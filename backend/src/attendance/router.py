from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import verificar_rol
from src.core.services import registrar_auditoria          # ← NUEVO
from src.attendance.models import Inasistencia, TIPOS_QUE_DESCUENTAN
from src.attendance.schemas import InasistenciaCreate, InasistenciaResponse
from src.hr.models import Empleado
from src.attendance.zkteco_sync import sincronizar_zkteco
from src.core.dependencies import obtener_usuario_actual

router = APIRouter()


def _enriquecer(inasistencia: Inasistencia) -> dict:
    data = {c.name: getattr(inasistencia, c.name) for c in inasistencia.__table__.columns}
    data["descuenta_sueldo"] = inasistencia.tipo in TIPOS_QUE_DESCUENTAN
    return data


@router.post("/", response_model=InasistenciaResponse, status_code=status.HTTP_201_CREATED)
def registrar_inasistencia(
    datos: InasistenciaCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == datos.empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado en esta empresa")

    periodo = datos.fecha.strftime("%Y-%m")
    inasistencia = Inasistencia(
        **datos.model_dump(),
        empresa_id=usuario_actual.empresa_id,
        periodo=periodo,
        registrado_por=usuario_actual.usuario_id,
    )
    db.add(inasistencia)
    db.commit()
    db.refresh(inasistencia)

    # RF-16: registrar en auditoría
    registrar_auditoria(
        db,
        usuario_actual.usuario_id,
        "REGISTRAR_INASISTENCIA",
        "Asistencia",
        {
            "empleado_id": datos.empleado_id,
            "fecha": str(datos.fecha),
            "tipo": datos.tipo,
            "horas_ausentes": float(datos.horas_ausentes),
        },
    )

    return _enriquecer(inasistencia)


@router.get("/empleado/{empleado_id}", response_model=List[InasistenciaResponse])
def listar_inasistencias(
    empleado_id: int,
    periodo: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente", "Empleado"])),  # ← Empleado puede ver las suyas
):
    query = db.query(Inasistencia).filter(
        Inasistencia.empleado_id == empleado_id,
        Inasistencia.empresa_id == usuario_actual.empresa_id,
    )
    if periodo:
        query = query.filter(Inasistencia.periodo == periodo)

    return [_enriquecer(i) for i in query.order_by(Inasistencia.fecha).all()]


@router.delete("/{inasistencia_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_inasistencia(
    inasistencia_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    inasistencia = db.query(Inasistencia).filter(
        Inasistencia.inasistencia_id == inasistencia_id,
        Inasistencia.empresa_id == usuario_actual.empresa_id,
    ).first()
    if not inasistencia:
        raise HTTPException(status_code=404, detail="Inasistencia no encontrada")

    # RF-16: registrar en auditoría antes de borrar
    registrar_auditoria(
        db,
        usuario_actual.usuario_id,
        "ELIMINAR_INASISTENCIA",
        "Asistencia",
        {"inasistencia_id": inasistencia_id},
    )

    db.delete(inasistencia)
    db.commit()

@router.post("/sync-zkteco")
def sync_zkteco(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    """
    RF-07: Conecta con el biométrico ZKTeco y extrae las marcaciones del día.
    Requiere que ZKTECO_IP esté configurada en el .env
    """
    try:
        resultado = sincronizar_zkteco(db, usuario_actual.empresa_id)
        registrar_auditoria(
            db,
            usuario_actual.usuario_id,
            "SYNC_ZKTECO",
            "Asistencia",
            resultado,
        )
        return resultado
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))