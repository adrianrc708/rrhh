from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Text, Numeric
from sqlalchemy.sql import func
from src.database import Base


class Empresa(Base):
    __tablename__ = "empresas"

    empresa_id = Column(Integer, primary_key=True, index=True)
    razon_social = Column(String(150), nullable=False)
    ruc = Column(String(20), unique=True, nullable=False)
    plan_suscripcion = Column(String(50), default="Premium")
    fecha_registro = Column(TIMESTAMP, server_default=func.now())


class Usuario(Base):
    __tablename__ = "usuarios"

    usuario_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    nombre = Column(String(100), nullable=False)
    correo = Column(String(150), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    rol = Column(String(50), nullable=False)
    estado = Column(String(20), default="Activo")


class Nomina(Base):
    __tablename__ = "nominas"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    periodo = Column(String(20), nullable=False)
    estado = Column(String(50), default="Borrador")  # Borrador | Revision | Aprobado | Pagado
    total_ingresos = Column(Numeric(10, 2), default=0.00)
    total_descuentos = Column(Numeric(10, 2), default=0.00)
    total_neto = Column(Numeric(10, 2), default=0.00)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    fecha_aprobacion = Column(TIMESTAMP, nullable=True)
    aprobado_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)


class DetalleNomina(Base):
    """
    Representa la boleta de pago individual de un empleado dentro de una nómina.
    Columnas nuevas (horas_*, descuento_inasistencias, *_pension, impuesto_*,
    total_ingresos_brutos, aporte_empleador_essalud) requieren ALTER TABLE
    si la tabla ya existía en la BD.
    """
    __tablename__ = "detalles_nomina"

    id = Column(Integer, primary_key=True, index=True)
    nomina_id = Column(Integer, ForeignKey("nominas.id", ondelete="CASCADE"))
    usuario_id = Column(Integer, ForeignKey("usuarios.usuario_id"))
    # Horas (RF-11)
    horas_contrato_mes = Column(Numeric(6, 2), nullable=True)
    horas_trabajadas = Column(Numeric(6, 2), nullable=True)
    horas_ausentes = Column(Numeric(6, 2), nullable=True, default=0)
    # Ingresos (RF-11)
    sueldo_base = Column(Numeric(10, 2), nullable=False)
    haberes = Column(Numeric(10, 2), default=0.00)
    descuento_inasistencias = Column(Numeric(10, 2), nullable=True, default=0)  # RF-17
    total_ingresos_brutos = Column(Numeric(10, 2), nullable=True)
    # Descuentos legales (RF-11)
    tipo_pension = Column(String(10), nullable=True)
    aporte_pension = Column(Numeric(10, 2), nullable=True, default=0)
    impuesto_renta_5ta = Column(Numeric(10, 2), nullable=True, default=0)
    # Totales
    descuentos = Column(Numeric(10, 2), default=0.00)
    sueldo_neto = Column(Numeric(10, 2), nullable=False)
    # Aporte empleador (informativo, no se descuenta al trabajador)
    aporte_empleador_essalud = Column(Numeric(10, 2), nullable=True, default=0)


class HistorialAprobacion(Base):
    __tablename__ = "historiales_aprobacion"

    id = Column(Integer, primary_key=True, index=True)
    nomina_id = Column(Integer, ForeignKey("nominas.id", ondelete="CASCADE"))
    usuario_id = Column(Integer, ForeignKey("usuarios.usuario_id"))
    estado_anterior = Column(String(50), nullable=False)
    estado_nuevo = Column(String(50), nullable=False)
    comentarios = Column(Text, nullable=True)
    fecha_cambio = Column(TIMESTAMP, server_default=func.now())


class EventoAuditoria(Base):
    __tablename__ = "eventos_auditoria"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    accion = Column(String(100), nullable=False)
    modulo = Column(String(50), nullable=False)
    detalles = Column(Text, nullable=True)
    fecha_evento = Column(TIMESTAMP, server_default=func.now())
