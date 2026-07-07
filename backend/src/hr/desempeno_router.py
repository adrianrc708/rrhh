from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import obtener_usuario_actual, obtener_empleado_actual, verificar_rol, verificar_empleado_en_alcance
from src.core.services import registrar_auditoria
from src.hr.models import Empleado
from src.hr.desempeno_models import EvaluacionDesempeno, IncidenciaDisciplinaria

router = APIRouter()

TIPOS_INCIDENCIA = {"Amonestacion_verbal", "Amonestacion_escrita", "Memorandum", "Suspension"}


# ── Schemas inline ──

class EvaluacionCreate(BaseModel):
    empleado_id: int
    periodo: str
    puntualidad: int = Field(ge=1, le=5)
    calidad_trabajo: int = Field(ge=1, le=5)
    trabajo_equipo: int = Field(ge=1, le=5)
    iniciativa: int = Field(ge=1, le=5)
    comentarios: Optional[str] = None


class EvaluacionResponse(BaseModel):
    id: int
    empleado_id: int
    nombre_empleado: Optional[str] = None
    periodo: str
    puntualidad: int
    calidad_trabajo: int
    trabajo_equipo: int
    iniciativa: int
    puntaje_promedio: float
    comentarios: Optional[str] = None
    fecha_evaluacion: datetime

    class Config:
        from_attributes = True


class IncidenciaCreate(BaseModel):
    empleado_id: int
    tipo: str
    fecha: date
    motivo: str
    dias_suspension: Optional[int] = None


class IncidenciaResponse(BaseModel):
    id: int
    empleado_id: int
    nombre_empleado: Optional[str] = None
    tipo: str
    fecha: date
    motivo: str
    dias_suspension: Optional[int] = None
    fecha_registro: datetime

    class Config:
        from_attributes = True


def _a_evaluacion(e: EvaluacionDesempeno, nombre: Optional[str] = None) -> EvaluacionResponse:
    return EvaluacionResponse(
        id=e.id, empleado_id=e.empleado_id, nombre_empleado=nombre, periodo=e.periodo,
        puntualidad=e.puntualidad, calidad_trabajo=e.calidad_trabajo, trabajo_equipo=e.trabajo_equipo,
        iniciativa=e.iniciativa, puntaje_promedio=float(e.puntaje_promedio), comentarios=e.comentarios,
        fecha_evaluacion=e.fecha_evaluacion,
    )


def _a_incidencia(i: IncidenciaDisciplinaria, nombre: Optional[str] = None) -> IncidenciaResponse:
    return IncidenciaResponse(
        id=i.id, empleado_id=i.empleado_id, nombre_empleado=nombre, tipo=i.tipo, fecha=i.fecha,
        motivo=i.motivo, dias_suspension=i.dias_suspension, fecha_registro=i.fecha_registro,
    )


# ==========================================================================
# Evaluación de desempeño (Admin / RRHH / Gerente — acotado a su alcance)
# ==========================================================================

@router.post("/evaluaciones", response_model=EvaluacionResponse, status_code=status.HTTP_201_CREATED)
def crear_evaluacion(
    datos: EvaluacionCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    empleado = verificar_empleado_en_alcance(db, usuario_actual, datos.empleado_id)
    promedio = Decimal(datos.puntualidad + datos.calidad_trabajo + datos.trabajo_equipo + datos.iniciativa) / Decimal("4")

    evaluacion = EvaluacionDesempeno(
        empresa_id=usuario_actual.empresa_id,
        empleado_id=datos.empleado_id,
        periodo=datos.periodo,
        puntualidad=datos.puntualidad,
        calidad_trabajo=datos.calidad_trabajo,
        trabajo_equipo=datos.trabajo_equipo,
        iniciativa=datos.iniciativa,
        puntaje_promedio=promedio.quantize(Decimal("0.01")),
        comentarios=datos.comentarios,
        evaluado_por=usuario_actual.usuario_id,
    )
    db.add(evaluacion)
    db.commit()
    db.refresh(evaluacion)
    registrar_auditoria(db, usuario_actual.usuario_id, "CREAR_EVALUACION_DESEMPENO", "HR",
                        {"empleado_id": datos.empleado_id, "periodo": datos.periodo, "promedio": float(promedio)})
    return _a_evaluacion(evaluacion, empleado.nombre)


@router.get("/evaluaciones/{empleado_id}", response_model=List[EvaluacionResponse])
def listar_evaluaciones(
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    empleado = verificar_empleado_en_alcance(db, usuario_actual, empleado_id)
    evaluaciones = db.query(EvaluacionDesempeno).filter(
        EvaluacionDesempeno.empleado_id == empleado_id,
        EvaluacionDesempeno.is_deleted.is_(False),
    ).order_by(EvaluacionDesempeno.periodo.desc()).all()
    return [_a_evaluacion(e, empleado.nombre) for e in evaluaciones]


@router.get("/mis-evaluaciones", response_model=List[EvaluacionResponse])
def mis_evaluaciones(
    empleado: Empleado = Depends(obtener_empleado_actual),
    db: Session = Depends(get_db),
):
    evaluaciones = db.query(EvaluacionDesempeno).filter(
        EvaluacionDesempeno.empleado_id == empleado.empleado_id,
        EvaluacionDesempeno.is_deleted.is_(False),
    ).order_by(EvaluacionDesempeno.periodo.desc()).all()
    return [_a_evaluacion(e, empleado.nombre) for e in evaluaciones]


# ==========================================================================
# Kardex disciplinario (Admin / RRHH / Gerente — acotado a su alcance)
# ==========================================================================

@router.post("/incidencias", response_model=IncidenciaResponse, status_code=status.HTTP_201_CREATED)
def crear_incidencia(
    datos: IncidenciaCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    if datos.tipo not in TIPOS_INCIDENCIA:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Opciones: {', '.join(TIPOS_INCIDENCIA)}")
    empleado = verificar_empleado_en_alcance(db, usuario_actual, datos.empleado_id)

    incidencia = IncidenciaDisciplinaria(
        empresa_id=usuario_actual.empresa_id,
        empleado_id=datos.empleado_id,
        tipo=datos.tipo,
        fecha=datos.fecha,
        motivo=datos.motivo,
        dias_suspension=datos.dias_suspension if datos.tipo == "Suspension" else None,
        registrado_por=usuario_actual.usuario_id,
    )
    db.add(incidencia)
    db.commit()
    db.refresh(incidencia)
    registrar_auditoria(db, usuario_actual.usuario_id, "CREAR_INCIDENCIA_DISCIPLINARIA", "HR",
                        {"empleado_id": datos.empleado_id, "tipo": datos.tipo})
    return _a_incidencia(incidencia, empleado.nombre)


@router.get("/incidencias/{empleado_id}", response_model=List[IncidenciaResponse])
def listar_incidencias(
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    empleado = verificar_empleado_en_alcance(db, usuario_actual, empleado_id)
    incidencias = db.query(IncidenciaDisciplinaria).filter(
        IncidenciaDisciplinaria.empleado_id == empleado_id,
        IncidenciaDisciplinaria.is_deleted.is_(False),
    ).order_by(IncidenciaDisciplinaria.fecha.desc()).all()
    return [_a_incidencia(i, empleado.nombre) for i in incidencias]


@router.get("/mis-incidencias", response_model=List[IncidenciaResponse])
def mis_incidencias(
    empleado: Empleado = Depends(obtener_empleado_actual),
    db: Session = Depends(get_db),
):
    incidencias = db.query(IncidenciaDisciplinaria).filter(
        IncidenciaDisciplinaria.empleado_id == empleado.empleado_id,
        IncidenciaDisciplinaria.is_deleted.is_(False),
    ).order_by(IncidenciaDisciplinaria.fecha.desc()).all()
    return [_a_incidencia(i, empleado.nombre) for i in incidencias]
