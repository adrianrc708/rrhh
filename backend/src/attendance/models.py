from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Numeric, Text, Date, Boolean, Float
from sqlalchemy.sql import func
from src.database import Base

# Tipos válidos de inasistencia
TIPOS_INASISTENCIA = [
    "Injustificada",
    "Justificada",
    "Permiso_sin_goce",
    "Permiso_con_goce",
    "Licencia",
]

# Solo estos tipos generan descuento en el sueldo (RF-17)
TIPOS_QUE_DESCUENTAN = {"Injustificada", "Permiso_sin_goce"}


class Inasistencia(Base):
    __tablename__ = "inasistencias"

    inasistencia_id = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"))
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    fecha = Column(Date, nullable=False)
    tipo = Column(String(50), nullable=False)
    horas_ausentes = Column(Numeric(4, 2), default=8.0)
    periodo = Column(String(7), nullable=False)  # YYYY-MM, derivado de fecha
    observaciones = Column(Text, nullable=True)
    registrado_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    fecha_registro = Column(TIMESTAMP, server_default=func.now())


# ============================================================================
# Fase 3 — Kiosco facial web, marcaciones biométricas y jornadas atípicas.
# ============================================================================

class DispositivoKiosco(Base):
    """
    Tablet/dispositivo de marcación. Se autentica con un token propio (no una
    sesión de usuario) para no exponer credenciales administrativas en el kiosco.
    El token y el PIN se guardan hasheados.
    """
    __tablename__ = "dispositivos_kiosco"

    dispositivo_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    nombre = Column(String(100), nullable=False)          # "Tablet Puerta Principal"
    token_hash = Column(Text, nullable=False)             # hash del secreto del dispositivo
    pin_hash = Column(Text, nullable=False)               # hash del PIN de provisionamiento
    activo = Column(Boolean, default=True, nullable=False)
    ultimo_uso = Column(TIMESTAMP, nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class RostroEmpleado(Base):
    """Descriptor facial de 128 dimensiones (face-api.js) enrolado para un empleado."""
    __tablename__ = "rostros_empleado"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    descriptor = Column(Text, nullable=False)             # JSON: lista de 128 floats
    etiqueta = Column(String(50), nullable=True)          # "muestra 1"
    activo = Column(Boolean, default=True, nullable=False)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class Marcacion(Base):
    """Marcación biométrica/remota de entrada o salida."""
    __tablename__ = "marcaciones"

    marcacion_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    tipo = Column(String(10), nullable=False)             # entrada | salida
    momento = Column(TIMESTAMP, nullable=False)           # instante exacto de la marcación
    fecha = Column(Date, nullable=False, index=True)
    periodo = Column(String(7), nullable=False, index=True)  # YYYY-MM
    origen = Column(String(10), nullable=False, default="kiosco")  # kiosco | remoto | manual
    dispositivo_id = Column(Integer, ForeignKey("dispositivos_kiosco.dispositivo_id", ondelete="SET NULL"), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    ip = Column(String(45), nullable=True)
    distancia_match = Column(Float, nullable=True)        # distancia biométrica del reconocimiento
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class CicloJornada(Base):
    """
    Jornada atípica cíclica (ej. 14x7): 14 días de trabajo seguidos de 7 de descanso.
    Permite no penalizar los descansos programados y tratar el trabajo en ellos como
    sobretiempo.
    """
    __tablename__ = "ciclos_jornada"

    ciclo_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    nombre = Column(String(50), nullable=False)           # "14x7"
    dias_trabajo = Column(Integer, nullable=False)
    dias_descanso = Column(Integer, nullable=False)
    fecha_inicio_ciclo = Column(Date, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class CierreAsistencia(Base):
    """Estado de conciliación de la asistencia de una empresa para un periodo."""
    __tablename__ = "cierres_asistencia"

    cierre_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    periodo = Column(String(7), nullable=False, index=True)  # YYYY-MM
    estado = Column(String(15), default="Abierto", nullable=False)  # Abierto | Congelado
    cerrado_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    fecha_cierre = Column(TIMESTAMP, nullable=True)
