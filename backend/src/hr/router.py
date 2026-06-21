from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import obtener_usuario_actual, verificar_rol
from src.hr.models import Empleado
from src.hr.schemas import EmpleadoCreate, EmpleadoUpdate, EmpleadoResponse

router = APIRouter()


@router.post("/", response_model=EmpleadoResponse, status_code=status.HTTP_201_CREATED)
def crear_empleado(
    datos: EmpleadoCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    if db.query(Empleado).filter(Empleado.usuario_id == datos.usuario_id).first():
        raise HTTPException(status_code=409, detail="El usuario ya tiene un perfil de empleado")

    usuario = db.query(Usuario).filter(
        Usuario.usuario_id == datos.usuario_id,
        Usuario.empresa_id == usuario_actual.empresa_id,
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado en esta empresa")

    if datos.tipo_pension not in ("AFP", "ONP"):
        raise HTTPException(status_code=400, detail="tipo_pension debe ser 'AFP' o 'ONP'")

    empleado = Empleado(**datos.model_dump(), empresa_id=usuario_actual.empresa_id)
    db.add(empleado)
    db.commit()
    db.refresh(empleado)
    return empleado


@router.get("/", response_model=List[EmpleadoResponse])
def listar_empleados(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    return db.query(Empleado).filter(Empleado.empresa_id == usuario_actual.empresa_id).all()


@router.get("/{empleado_id}", response_model=EmpleadoResponse)
def obtener_empleado(
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return empleado


@router.patch("/{empleado_id}", response_model=EmpleadoResponse)
def actualizar_empleado(
    empleado_id: int,
    datos: EmpleadoUpdate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(empleado, campo, valor)

    db.commit()
    db.refresh(empleado)
    return empleado


@router.delete("/{empleado_id}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_empleado(
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    empleado.estado = "Inactivo"
    db.commit()
