from sqlalchemy import Column, Integer, String, Numeric, TIMESTAMP, ForeignKey, Text, Date, Boolean
from sqlalchemy.sql import func
from src.database import Base


class EvaluacionDesempeno(Base):
    """Fase 5 — Evaluación periódica de desempeño (escala 1-5 por criterio)."""
    __tablename__ = "evaluaciones_desempeno"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    periodo = Column(String(7), nullable=False, index=True)  # YYYY-MM evaluado
    puntualidad = Column(Integer, nullable=False)
    calidad_trabajo = Column(Integer, nullable=False)
    trabajo_equipo = Column(Integer, nullable=False)
    iniciativa = Column(Integer, nullable=False)
    puntaje_promedio = Column(Numeric(3, 2), nullable=False)
    comentarios = Column(Text, nullable=True)
    evaluado_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    fecha_evaluacion = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class IncidenciaDisciplinaria(Base):
    """Fase 5 — Kardex disciplinario: amonestaciones, memorándums y suspensiones."""
    __tablename__ = "incidencias_disciplinarias"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    tipo = Column(String(30), nullable=False)  # Amonestacion_verbal | Amonestacion_escrita | Memorandum | Suspension
    fecha = Column(Date, nullable=False)
    motivo = Column(Text, nullable=False)
    dias_suspension = Column(Integer, nullable=True)
    registrado_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    fecha_registro = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
