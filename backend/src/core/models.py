from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Text, Numeric, Boolean, Date
from sqlalchemy.sql import func
from src.database import Base


class Empresa(Base):
    __tablename__ = "empresas"

    empresa_id = Column(Integer, primary_key=True, index=True)
    razon_social = Column(String(150), nullable=False)
    ruc = Column(String(20), unique=True, nullable=False)
    plan_suscripcion = Column(String(50), default="Premium")
    estado = Column(String(20), default="Activa")
    # Fase 2: régimen laboral de la empresa (General | MYPE_Pequena | MYPE_Micro).
    # Condiciona el motor de cálculo (EsSalud/beneficios) y la auditoría normativa.
    regimen_laboral = Column(String(20), default="General", nullable=False)
    fecha_registro = Column(TIMESTAMP, server_default=func.now())
    # Fase 1: borrado lógico para evitar la destrucción en cascada de datos.
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class Usuario(Base):
    __tablename__ = "usuarios"

    usuario_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    nombre = Column(String(100), nullable=False)
    correo = Column(String(150), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    rol = Column(String(50), nullable=False)
    estado = Column(String(20), default="Activo")
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


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
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


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
    # Fase 2: conceptos remunerativos adicionales (segmentación horaria + sector)
    perfil_contrato = Column(String(20), nullable=True)  # Comun | Minero | Agrario | ...
    pago_horas_extra_25 = Column(Numeric(10, 2), nullable=True, default=0)
    pago_horas_extra_35 = Column(Numeric(10, 2), nullable=True, default=0)
    pago_horas_nocturnas = Column(Numeric(10, 2), nullable=True, default=0)
    bonos_sector = Column(Numeric(10, 2), nullable=True, default=0)
    # Descuentos legales (RF-11)
    tipo_pension = Column(String(10), nullable=True)
    aporte_pension = Column(Numeric(10, 2), nullable=True, default=0)
    impuesto_renta_5ta = Column(Numeric(10, 2), nullable=True, default=0)
    # Totales
    descuentos = Column(Numeric(10, 2), default=0.00)
    sueldo_neto = Column(Numeric(10, 2), nullable=False)
    # Aporte empleador (informativo, no se descuenta al trabajador)
    aporte_empleador_essalud = Column(Numeric(10, 2), nullable=True, default=0)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


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

class Pago(Base):
    __tablename__ = "pagos"

    pago_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    plan = Column(String(50), nullable=False)
    num_empleados = Column(Integer, nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)
    metodo_pago = Column(String(30), nullable=False)  # Tarjeta | Yape | Transferencia
    tarjeta_ultimos4 = Column(String(4), nullable=True)
    referencia = Column(String(50), unique=True, nullable=False)
    estado = Column(String(20), default="Aprobado")
    fecha_pago = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class Notificacion(Base):
    __tablename__ = "notificaciones"

    notificacion_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    usuario_id = Column(Integer, ForeignKey("usuarios.usuario_id", ondelete="CASCADE"), nullable=True)
    titulo = Column(String(150), nullable=False)
    mensaje = Column(Text, nullable=False)
    leido = Column(Boolean, default=False)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class ParametroFiscal(Base):
    """
    Fase 1: parámetros fiscales/macro versionados por fecha de vigencia (RMV, UIT,
    tasas ONP/AFP/EsSalud, etc.). Son globales: no dependen de la empresa y afectan
    los cálculos de nómina de todas ellas. El registro histórico se mantiene: al
    crear una nueva vigencia se cierra (vigencia_hasta) la vigencia anterior de la
    misma clave. La lectura busca la fila vigente en una fecha dada.
    """
    __tablename__ = "parametros_fiscales"

    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String(50), nullable=False, index=True)   # RMV | UIT | TASA_ONP | ...
    valor = Column(Numeric(14, 6), nullable=False)
    descripcion = Column(String(200), nullable=True)
    vigencia_desde = Column(Date, nullable=False)
    vigencia_hasta = Column(Date, nullable=True)             # NULL = vigente actualmente
    activo = Column(Boolean, default=True, nullable=False)
    creado_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())


class HorasPeriodo(Base):
    """
    Fase 2: horas de sobretiempo/nocturnas por empleado y periodo (YYYY-MM).
    Es el puente de captura manual (RRHH) mientras el Kiosco facial de la Fase 3
    no las clasifica automáticamente. La consolidación las lee para valorizarlas.
    Debe existir a lo sumo una fila por (empleado_id, periodo).
    """
    __tablename__ = "horas_periodo"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    periodo = Column(String(7), nullable=False, index=True)  # YYYY-MM
    horas_extra_25 = Column(Numeric(6, 2), nullable=False, default=0)
    horas_extra_35 = Column(Numeric(6, 2), nullable=False, default=0)
    horas_nocturnas = Column(Numeric(6, 2), nullable=False, default=0)
    registrado_por = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=True)
    fecha_registro = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class AlertaNormativa(Base):
    """
    Fase 2: hallazgos de la auditoría normativa sobre una pre-nómina. Un hallazgo
    de nivel 'bloqueo' impide la transición a 'Aprobado'. Se regenera en cada
    consolidación.
    """
    __tablename__ = "alertas_normativas"

    id = Column(Integer, primary_key=True, index=True)
    nomina_id = Column(Integer, ForeignKey("nominas.id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="SET NULL"), nullable=True)
    nivel = Column(String(15), nullable=False)   # bloqueo | advertencia
    concepto = Column(String(60), nullable=False)
    mensaje = Column(Text, nullable=False)
    explicacion = Column(Text, nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
