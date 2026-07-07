"""
Fase 5 — Beneficios sociales y autogestión.

Modelos nuevos (todas tablas nuevas, las crea Base.metadata.create_all):
  - SolicitudAutogestion: vacaciones / permisos / descansos médicos que el
    Empleado enruta a su Gerente (jefe_id). El Gerente aprueba/rechaza y RRHH
    recibe el consolidado.
  - BeneficioSocial: cálculo persistido de gratificaciones (Jul/Dic), CTS
    (May/Nov) y liquidaciones por cese.
  - EvaluacionDesempeno: calificaciones y kardex disciplinario del equipo directo.

La aprobación de sobretiempo del Gerente reutiliza HorasPeriodo (Fase 2): se le
añaden columnas de aprobación por ALTER idempotente en seed.py.
"""
from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Numeric, Text, Date, Boolean
from sqlalchemy.sql import func
from src.database import Base


# Tipos de solicitud de autogestión del empleado.
TIPOS_SOLICITUD = ["Vacaciones", "Permiso", "Licencia_medica"]

# Estados del flujo de aprobación (Empleado -> Gerente -> RRHH informado).
ESTADO_PENDIENTE = "Pendiente"
ESTADO_APROBADA = "Aprobada"
ESTADO_RECHAZADA = "Rechazada"


class SolicitudAutogestion(Base):
    """
    Solicitud de autogestión del trabajador (vacaciones, permiso o descanso
    médico). Se enruta automáticamente al Gerente (jefe directo) que la aprueba o
    rechaza; al aprobarse se notifica a RRHH para el cierre de planilla.
    """
    __tablename__ = "solicitudes_autogestion"

    solicitud_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    tipo = Column(String(20), nullable=False)             # Vacaciones | Permiso | Licencia_medica
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    dias = Column(Integer, nullable=False, default=1)
    con_goce = Column(Boolean, default=True, nullable=False)  # permiso con/sin goce de haber
    motivo = Column(Text, nullable=True)

    # Carga documental (p. ej. certificado de descanso médico). Se guarda el
    # nombre y el contenido en base64 para no depender de almacenamiento externo.
    documento_nombre = Column(String(150), nullable=True)
    documento_datos = Column(Text, nullable=True)

    # Ruteo y resolución.
    aprobador_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="SET NULL"), nullable=True)
    estado = Column(String(15), default=ESTADO_PENDIENTE, nullable=False, index=True)
    resuelto_por = Column(Integer, ForeignKey("usuarios.usuario_id", ondelete="SET NULL"), nullable=True)
    comentario_resolucion = Column(Text, nullable=True)
    fecha_resolucion = Column(TIMESTAMP, nullable=True)

    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class BeneficioSocial(Base):
    """
    Cálculo persistido de un beneficio social peruano: gratificación, CTS o
    liquidación por cese. Se guarda el desglose (JSON) para trazabilidad y la
    boleta/legajo. Estado: Calculado -> Pagado.
    """
    __tablename__ = "beneficios_sociales"

    beneficio_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    tipo = Column(String(20), nullable=False)             # Gratificacion | CTS | Liquidacion
    periodo = Column(String(20), nullable=False)          # "Julio 2026" | "2026-05" | "Cese 2026-07"
    meses_computables = Column(Numeric(5, 2), nullable=True)
    remuneracion_computable = Column(Numeric(10, 2), nullable=True)
    monto = Column(Numeric(10, 2), nullable=False, default=0)
    detalle = Column(Text, nullable=True)                 # JSON con el desglose del cálculo
    estado = Column(String(15), default="Calculado", nullable=False)  # Calculado | Pagado
    calculado_por = Column(Integer, ForeignKey("usuarios.usuario_id", ondelete="SET NULL"), nullable=True)
    fecha_calculo = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class EvaluacionDesempeno(Base):
    """
    Evaluación de desempeño o asiento de kardex disciplinario del equipo directo
    del Gerente. `tipo` distingue una calificación periódica de un asiento
    positivo/disciplinario puntual.
    """
    __tablename__ = "evaluaciones_desempeno"

    evaluacion_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    evaluado_por = Column(Integer, ForeignKey("usuarios.usuario_id", ondelete="SET NULL"), nullable=True)
    tipo = Column(String(20), default="Evaluacion", nullable=False)  # Evaluacion | Kardex_positivo | Kardex_disciplinario
    periodo = Column(String(20), nullable=True)           # "2026-Q3", opcional
    puntaje = Column(Integer, nullable=True)              # 1..5 (solo Evaluacion)
    comentario = Column(Text, nullable=False)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
