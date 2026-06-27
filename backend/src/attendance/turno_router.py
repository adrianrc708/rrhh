from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from pydantic import BaseModel

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import verificar_rol
from src.core.services import registrar_auditoria
from src.attendance.turno_models import Turno, AsignacionTurno

router = APIRouter()


# ── Schemas inline (puedes moverlos a un schemas file si quieres) ──

class TurnoCreate(BaseModel):
    nombre: str
    hora_entrada: str   # "08:00"
    hora_salida: str    # "17:00"
    descripcion: Optional[str] = None

class TurnoResponse(TurnoCreate):
    turno_id: int
    empresa_id: int
    class Config:
        from_attributes = True

class AsignacionCreate(BaseModel):
    empleado_id: int
    turno_id: int
    fecha_inicio: date
    fecha_fin: Optional[date] = None

class AsignacionResponse(AsignacionCreate):
    asignacion_id: int
    class Config:
        from_attributes = True


# ── Endpoints turnos ──

@router.post("/", response_model=TurnoResponse, status_code=status.HTTP_201_CREATED)
def crear_turno(
    datos: TurnoCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    turno = Turno(**datos.model_dump(), empresa_id=usuario_actual.empresa_id)
    db.add(turno)
    db.commit()
    db.refresh(turno)
    registrar_auditoria(db, usuario_actual.usuario_id, "CREAR_TURNO", "Asistencia",
                        {"turno_id": turno.turno_id, "nombre": turno.nombre})
    return turno


@router.get("/", response_model=List[TurnoResponse])
def listar_turnos(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    return db.query(Turno).filter(Turno.empresa_id == usuario_actual.empresa_id).all()


@router.delete("/{turno_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_turno(
    turno_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    turno = db.query(Turno).filter(
        Turno.turno_id == turno_id,
        Turno.empresa_id == usuario_actual.empresa_id
    ).first()
    if not turno:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    db.delete(turno)
    db.commit()


# ── Endpoints asignaciones ──

@router.post("/asignaciones", response_model=AsignacionResponse, status_code=status.HTTP_201_CREATED)
def asignar_turno(
    datos: AsignacionCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    asignacion = AsignacionTurno(**datos.model_dump())
    db.add(asignacion)
    db.commit()
    db.refresh(asignacion)
    registrar_auditoria(db, usuario_actual.usuario_id, "ASIGNAR_TURNO", "Asistencia",
                        {"empleado_id": datos.empleado_id, "turno_id": datos.turno_id})
    return asignacion


@router.get("/asignaciones/empleado/{empleado_id}", response_model=List[AsignacionResponse])
def listar_asignaciones(
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente", "Empleado"])),
):
    return db.query(AsignacionTurno).filter(
        AsignacionTurno.empleado_id == empleado_id
    ).all()