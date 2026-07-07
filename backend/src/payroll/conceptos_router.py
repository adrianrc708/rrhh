from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import obtener_usuario_actual, obtener_empleado_actual, verificar_rol
from src.core.services import registrar_auditoria
from src.hr.models import Empleado
from src.payroll.conceptos_models import ConceptoVariable

router = APIRouter()

TIPOS_VALIDOS = {"Comision", "Adelanto", "Prestamo"}


# ── Schemas inline ──

class ConceptoCreate(BaseModel):
    empleado_id: int
    tipo: str
    periodo: str = Field(description="YYYY-MM: mes de abono (Comisión) u otorgamiento (Adelanto/Préstamo)")
    monto: float
    cuotas: int = 1
    descripcion: Optional[str] = None


class ConceptoResponse(BaseModel):
    id: int
    empleado_id: int
    nombre_empleado: Optional[str] = None
    tipo: str
    periodo: str
    monto: float
    cuotas: int
    descripcion: Optional[str] = None
    estado: str

    class Config:
        from_attributes = True


def _a_response(c: ConceptoVariable, nombre: Optional[str] = None) -> ConceptoResponse:
    return ConceptoResponse(
        id=c.id, empleado_id=c.empleado_id, nombre_empleado=nombre, tipo=c.tipo, periodo=c.periodo,
        monto=float(c.monto), cuotas=c.cuotas, descripcion=c.descripcion, estado=c.estado,
    )


@router.post("/", response_model=ConceptoResponse, status_code=status.HTTP_201_CREATED)
def crear_concepto(
    datos: ConceptoCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    if datos.tipo not in TIPOS_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Opciones: {', '.join(TIPOS_VALIDOS)}")
    if datos.monto <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero.")
    cuotas = 1 if datos.tipo != "Prestamo" else max(1, datos.cuotas)
    if datos.tipo == "Prestamo" and cuotas < 1:
        raise HTTPException(status_code=400, detail="Un préstamo debe tener al menos 1 cuota.")

    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == datos.empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado en tu empresa")

    concepto = ConceptoVariable(
        empresa_id=usuario_actual.empresa_id,
        empleado_id=datos.empleado_id,
        tipo=datos.tipo,
        periodo=datos.periodo,
        monto=datos.monto,
        cuotas=cuotas,
        descripcion=datos.descripcion,
        registrado_por=usuario_actual.usuario_id,
    )
    db.add(concepto)
    db.commit()
    db.refresh(concepto)
    registrar_auditoria(db, usuario_actual.usuario_id, "CREAR_CONCEPTO_VARIABLE", "Nómina",
                        {"empleado_id": datos.empleado_id, "tipo": datos.tipo, "monto": datos.monto})
    return _a_response(concepto, empleado.nombre)


@router.get("/", response_model=List[ConceptoResponse])
def listar_conceptos(
    empleado_id: Optional[int] = None,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    query = (
        db.query(ConceptoVariable, Empleado.nombre)
        .join(Empleado, Empleado.empleado_id == ConceptoVariable.empleado_id)
        .filter(
            ConceptoVariable.empresa_id == usuario_actual.empresa_id,
            ConceptoVariable.is_deleted.is_(False),
        )
    )
    if empleado_id:
        query = query.filter(ConceptoVariable.empleado_id == empleado_id)
    if tipo:
        query = query.filter(ConceptoVariable.tipo == tipo)
    resultados = query.order_by(ConceptoVariable.periodo.desc()).all()
    return [_a_response(c, nombre) for c, nombre in resultados]


@router.patch("/{concepto_id}/cancelar", response_model=ConceptoResponse)
def cancelar_concepto(
    concepto_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    """Detiene las cuotas pendientes de un adelanto/préstamo (o anula una comisión no aplicada)."""
    concepto = db.query(ConceptoVariable).filter(
        ConceptoVariable.id == concepto_id,
        ConceptoVariable.empresa_id == usuario_actual.empresa_id,
        ConceptoVariable.is_deleted.is_(False),
    ).first()
    if not concepto:
        raise HTTPException(status_code=404, detail="Concepto no encontrado")

    concepto.estado = "Cancelado"
    db.commit()
    db.refresh(concepto)
    registrar_auditoria(db, usuario_actual.usuario_id, "CANCELAR_CONCEPTO_VARIABLE", "Nómina", {"concepto_id": concepto_id})

    empleado = db.query(Empleado).filter(Empleado.empleado_id == concepto.empleado_id).first()
    return _a_response(concepto, empleado.nombre if empleado else None)


@router.get("/mis-conceptos", response_model=List[ConceptoResponse])
def mis_conceptos(
    empleado: Empleado = Depends(obtener_empleado_actual),
    db: Session = Depends(get_db),
):
    """Autogestión: el empleado consulta sus propias comisiones, adelantos y préstamos."""
    conceptos = db.query(ConceptoVariable).filter(
        ConceptoVariable.empleado_id == empleado.empleado_id,
        ConceptoVariable.is_deleted.is_(False),
    ).order_by(ConceptoVariable.periodo.desc()).all()
    return [_a_response(c, empleado.nombre) for c in conceptos]
