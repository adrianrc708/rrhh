"""
Fase 6 — Cumplimiento y salidas legales.

Tablas nuevas (las crea create_all):
  - LegajoDocumento : repositorio documental por trabajador (contratos, DNI,
    certificados médicos), guardado como base64 para no depender de storage externo.
  - CertificadoDigital : token/firma electrónica de la empresa para firmar boletas.
  - FirmaBoleta : constancia legal (auditable por SUNAFIL) de que el trabajador
    firmó/aceptó su boleta con su credencial (PIN/token de usuario).

Los exportadores legales (PLAME, T-Registro, AFPnet, dispersión bancaria) generan
archivos planos al vuelo y NO requieren tablas nuevas (viven en exporters.py).
"""
from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from src.database import Base


CATEGORIAS_LEGAJO = ["Contrato", "DNI", "Certificado_medico", "Titulo", "Otro"]


class LegajoDocumento(Base):
    __tablename__ = "legajo_documentos"

    documento_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="CASCADE"), index=True)
    categoria = Column(String(30), nullable=False, default="Otro")
    nombre = Column(String(150), nullable=False)
    datos = Column(Text, nullable=False)          # data URL base64 del archivo
    subido_por = Column(Integer, ForeignKey("usuarios.usuario_id", ondelete="SET NULL"), nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class CertificadoDigital(Base):
    __tablename__ = "certificados_digitales"

    certificado_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    nombre = Column(String(120), nullable=False)          # "Firma RRHH 2026"
    titular = Column(String(120), nullable=True)          # razón social / representante
    huella = Column(String(80), nullable=True)            # huella/serial referencial del token
    datos = Column(Text, nullable=True)                   # certificado (base64), opcional
    activo = Column(Boolean, default=True, nullable=False)
    fecha_carga = Column(TIMESTAMP, server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class FirmaBoleta(Base):
    __tablename__ = "firmas_boleta"

    firma_id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.empresa_id", ondelete="CASCADE"), index=True)
    detalle_id = Column(Integer, ForeignKey("detalles_nomina.id", ondelete="CASCADE"), index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.empleado_id", ondelete="SET NULL"), nullable=True)
    firmante = Column(String(20), nullable=False, default="empleado")  # empleado | empresa
    hash_firma = Column(String(80), nullable=True)        # sello de la firma
    certificado_id = Column(Integer, ForeignKey("certificados_digitales.certificado_id", ondelete="SET NULL"), nullable=True)
    ip = Column(String(45), nullable=True)
    fecha_firma = Column(TIMESTAMP, server_default=func.now())
