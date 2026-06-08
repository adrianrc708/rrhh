from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Text
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