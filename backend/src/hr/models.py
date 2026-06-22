from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Numeric, Date, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from src.database import Base

class Departamento(Base):
    __tablename__ = "departamentos"

    departamento_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    nombre = Column(String(100), nullable=False)

    # Relaciones
    cargos = relationship("Cargo", back_populates="departamento", cascade="all, delete-orphan")
    empleados = relationship("Empleado", back_populates="departamento_rel")


class Cargo(Base):
    __tablename__ = "cargos"

    cargo_id = Column(Integer, primary_key=True, index=True)
    departamento_id = Column(Integer, ForeignKey("departamentos.departamento_id", ondelete="CASCADE"))
    nombre = Column(String(100), nullable=False)
    
    # RF-04: Jerarquización de Puestos (Un cargo reporta a otro cargo del departamento)
    parent_id = Column(Integer, ForeignKey("cargos.cargo_id", ondelete="SET NULL"), nullable=True)

    # Relaciones y soporte autorreferencial para el árbol de puestos
    departamento = relationship("Departamento", back_populates="cargos")
    subcargos = relationship("Cargo", backref="jefe_directo", remote_side=[cargo_id])
    empleados = relationship("Empleado", back_populates="cargo_rel")


class Empleado(Base):
    __tablename__ = "empleados"

    empleado_id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.usuario_id", ondelete="CASCADE"), unique=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"))
    
    departamento_id = Column(Integer, ForeignKey("departamentos.departamento_id", ondelete="SET NULL"), nullable=True)
    cargo_id = Column(Integer, ForeignKey("cargos.cargo_id", ondelete="SET NULL"), nullable=True)

    tipo_pension = Column(String(10), default="ONP")
    porcentaje_afp = Column(Numeric(5, 4), nullable=True)
    
    fecha_ingreso = Column(Date, nullable=True)
    estado = Column(String(20), default="Activo")
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())

    departamento_rel = relationship("Departamento", back_populates="empleados")
    cargo_rel = relationship("Cargo", back_populates="empleados")
    contratos = relationship("Contrato", back_populates="empleado")


class Contrato(Base):
    __tablename__ = "contratos"

    contrato_id = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"))
    tipo_contrato = Column(String(50), nullable=False)
    
    sueldo_base = Column(Numeric(10, 2), nullable=False)
    horas_contrato_mes = Column(Numeric(6, 2), default=160)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=True)
    estado = Column(String(20), default="Vigente")
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())

    empleado = relationship("Empleado", back_populates="contratos")