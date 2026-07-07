"""
Fase 6 — Router de cumplimiento y salidas legales.

  · Exportadores SUNAT/AFP/banca (RRHH/Admin): PLAME, T-Registro, AFPnet, dispersión.
  · Legajo digital (RRHH/Admin sube; empleado ve el suyo).
  · Certificados digitales de la empresa (Admin).
  · Firma de boletas: empresa (lote) y empleado (con su credencial, auditable).
"""
import hashlib
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.models import Usuario, Nomina, DetalleNomina
from src.core.dependencies import (
    obtener_usuario_actual, verificar_rol, obtener_empleado_actual, alcance_empleados,
)
from src.core.security import verificar_password
from src.core.services import registrar_auditoria
from src.hr.models import Empleado
from src.compliance.models import (
    LegajoDocumento, CertificadoDigital, FirmaBoleta, CATEGORIAS_LEGAJO,
)
from src.compliance.exporters import (
    generar_plame, generar_tregistro, generar_afpnet, generar_dispersion, BANCOS,
)
from src.compliance.schemas import (
    ArchivoExport, LegajoCreate, LegajoResponse, CertificadoCreate, CertificadoResponse,
    FirmarBoletaRequest, FirmaResponse,
)

router = APIRouter()


def _get_nomina(db: Session, nomina_id: int, empresa_id: int) -> Nomina:
    nomina = db.query(Nomina).filter(
        Nomina.id == nomina_id, Nomina.empresa_id == empresa_id, Nomina.is_deleted.is_(False),
    ).first()
    if not nomina:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    return nomina


# ==========================================================================
# Exportadores legales
# ==========================================================================

@router.get("/nominas/{nomina_id}/plame", response_model=ArchivoExport)
def exportar_plame(
    nomina_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    nomina = _get_nomina(db, nomina_id, usuario_actual.empresa_id)
    contenido = generar_plame(db, nomina)
    registrar_auditoria(db, usuario_actual.usuario_id, "EXPORTAR_PLAME", "Cumplimiento", {"nomina_id": nomina_id})
    return ArchivoExport(filename=f"PLAME_{nomina.periodo}.txt", contenido=contenido, filas=contenido.count("\n"))


@router.get("/nominas/{nomina_id}/tregistro", response_model=ArchivoExport)
def exportar_tregistro(
    nomina_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    nomina = _get_nomina(db, nomina_id, usuario_actual.empresa_id)
    contenido = generar_tregistro(db, nomina)
    registrar_auditoria(db, usuario_actual.usuario_id, "EXPORTAR_TREGISTRO", "Cumplimiento", {"nomina_id": nomina_id})
    return ArchivoExport(filename=f"TREGISTRO_{nomina.periodo}.txt", contenido=contenido, filas=contenido.count("\n"))


@router.get("/nominas/{nomina_id}/afpnet", response_model=ArchivoExport)
def exportar_afpnet(
    nomina_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    nomina = _get_nomina(db, nomina_id, usuario_actual.empresa_id)
    contenido = generar_afpnet(db, nomina)
    registrar_auditoria(db, usuario_actual.usuario_id, "EXPORTAR_AFPNET", "Cumplimiento", {"nomina_id": nomina_id})
    return ArchivoExport(filename=f"AFPNET_{nomina.periodo}.csv", contenido=contenido,
                         mimetype="text/csv", filas=contenido.count("\n"))


@router.get("/nominas/{nomina_id}/dispersion", response_model=ArchivoExport)
def exportar_dispersion(
    nomina_id: int,
    banco: str = "BCP",
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    if banco not in BANCOS:
        raise HTTPException(status_code=400, detail=f"Banco no soportado. Opciones: {', '.join(BANCOS)}")
    nomina = _get_nomina(db, nomina_id, usuario_actual.empresa_id)
    if nomina.estado != "Pagado":
        # La dispersión bancaria se genera a partir de la nómina "Pagada".
        raise HTTPException(status_code=409, detail="La nómina debe estar en estado 'Pagado' para dispersar.")
    contenido = generar_dispersion(db, nomina, banco)
    ext = "txt" if banco == "BCP" else "csv"
    registrar_auditoria(db, usuario_actual.usuario_id, "EXPORTAR_DISPERSION", "Cumplimiento",
                        {"nomina_id": nomina_id, "banco": banco})
    return ArchivoExport(filename=f"DISPERSION_{banco}_{nomina.periodo}.{ext}", contenido=contenido,
                         mimetype="text/csv" if ext == "csv" else "text/plain", filas=contenido.count("\n"))


# ==========================================================================
# Legajo digital
# ==========================================================================

@router.post("/legajo", response_model=LegajoResponse, status_code=status.HTTP_201_CREATED)
def subir_documento(
    datos: LegajoCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == datos.empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    if datos.categoria not in CATEGORIAS_LEGAJO:
        datos.categoria = "Otro"

    doc = LegajoDocumento(
        empresa_id=usuario_actual.empresa_id, empleado_id=datos.empleado_id,
        categoria=datos.categoria, nombre=datos.nombre, datos=datos.datos,
        subido_por=usuario_actual.usuario_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return LegajoResponse(documento_id=doc.documento_id, empleado_id=doc.empleado_id,
                          categoria=doc.categoria, nombre=doc.nombre, datos=None,
                          fecha_creacion=doc.fecha_creacion)


@router.get("/legajo/mios", response_model=List[LegajoResponse])
def mis_documentos(
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    docs = db.query(LegajoDocumento).filter(
        LegajoDocumento.empleado_id == empleado.empleado_id,
        LegajoDocumento.is_deleted.is_(False),
    ).order_by(LegajoDocumento.fecha_creacion.desc()).all()
    return [LegajoResponse(documento_id=d.documento_id, empleado_id=d.empleado_id,
                           categoria=d.categoria, nombre=d.nombre, datos=None,
                           fecha_creacion=d.fecha_creacion) for d in docs]


@router.get("/legajo/{empleado_id}", response_model=List[LegajoResponse])
def documentos_empleado(
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin", "Gerente"])),
):
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None and empleado_id not in alcance:
        raise HTTPException(status_code=403, detail="Fuera de tu alcance.")
    docs = db.query(LegajoDocumento).filter(
        LegajoDocumento.empleado_id == empleado_id,
        LegajoDocumento.empresa_id == usuario_actual.empresa_id,
        LegajoDocumento.is_deleted.is_(False),
    ).order_by(LegajoDocumento.fecha_creacion.desc()).all()
    return [LegajoResponse(documento_id=d.documento_id, empleado_id=d.empleado_id,
                           categoria=d.categoria, nombre=d.nombre, datos=None,
                           fecha_creacion=d.fecha_creacion) for d in docs]


@router.get("/legajo/documento/{documento_id}/descargar", response_model=LegajoResponse)
def descargar_documento(
    documento_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    doc = db.query(LegajoDocumento).filter(
        LegajoDocumento.documento_id == documento_id,
        LegajoDocumento.empresa_id == usuario_actual.empresa_id,
        LegajoDocumento.is_deleted.is_(False),
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    # IDOR: un Empleado solo descarga documentos de su propia ficha.
    if usuario_actual.rol not in ("Admin", "RRHH", "SuperAdmin"):
        alcance = alcance_empleados(db, usuario_actual)
        if alcance is not None and doc.empleado_id not in alcance:
            raise HTTPException(status_code=403, detail="No autorizado.")
    return LegajoResponse(documento_id=doc.documento_id, empleado_id=doc.empleado_id,
                          categoria=doc.categoria, nombre=doc.nombre, datos=doc.datos,
                          fecha_creacion=doc.fecha_creacion)


@router.delete("/legajo/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_documento(
    documento_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    doc = db.query(LegajoDocumento).filter(
        LegajoDocumento.documento_id == documento_id,
        LegajoDocumento.empresa_id == usuario_actual.empresa_id,
        LegajoDocumento.is_deleted.is_(False),
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    doc.is_deleted = True
    db.commit()


# ==========================================================================
# Certificados digitales de la empresa
# ==========================================================================

@router.post("/certificados", response_model=CertificadoResponse, status_code=status.HTTP_201_CREATED)
def cargar_certificado(
    datos: CertificadoCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    cert = CertificadoDigital(
        empresa_id=usuario_actual.empresa_id, nombre=datos.nombre,
        titular=datos.titular, huella=datos.huella, datos=datos.datos, activo=True,
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert


@router.get("/certificados", response_model=List[CertificadoResponse])
def listar_certificados(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    return db.query(CertificadoDigital).filter(
        CertificadoDigital.empresa_id == usuario_actual.empresa_id,
        CertificadoDigital.is_deleted.is_(False),
    ).order_by(CertificadoDigital.fecha_carga.desc()).all()


@router.delete("/certificados/{certificado_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_certificado(
    certificado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    cert = db.query(CertificadoDigital).filter(
        CertificadoDigital.certificado_id == certificado_id,
        CertificadoDigital.empresa_id == usuario_actual.empresa_id,
        CertificadoDigital.is_deleted.is_(False),
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    cert.is_deleted = True
    db.commit()


# ==========================================================================
# Firma de boletas
# ==========================================================================

def _sello(*partes: str) -> str:
    return hashlib.sha256("|".join(partes).encode()).hexdigest()[:32]


@router.post("/nominas/{nomina_id}/firmar-lote")
def firmar_boletas_lote(
    nomina_id: int,
    certificado_id: Optional[int] = None,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    """Firma en lote (con el certificado de la empresa) todas las boletas de la nómina."""
    nomina = _get_nomina(db, nomina_id, usuario_actual.empresa_id)
    cert = None
    if certificado_id:
        cert = db.query(CertificadoDigital).filter(
            CertificadoDigital.certificado_id == certificado_id,
            CertificadoDigital.empresa_id == usuario_actual.empresa_id,
            CertificadoDigital.is_deleted.is_(False),
        ).first()
        if not cert:
            raise HTTPException(status_code=404, detail="Certificado no encontrado")

    detalles = db.query(DetalleNomina).filter(
        DetalleNomina.nomina_id == nomina_id, DetalleNomina.is_deleted.is_(False),
    ).all()
    firmadas = 0
    for d in detalles:
        ya = db.query(FirmaBoleta).filter(
            FirmaBoleta.detalle_id == d.id, FirmaBoleta.firmante == "empresa",
        ).first()
        if ya:
            continue
        db.add(FirmaBoleta(
            empresa_id=usuario_actual.empresa_id, detalle_id=d.id, empleado_id=None,
            firmante="empresa", certificado_id=certificado_id,
            hash_firma=_sello("empresa", str(d.id), nomina.periodo),
        ))
        firmadas += 1
    db.commit()
    registrar_auditoria(db, usuario_actual.usuario_id, "FIRMAR_BOLETAS_LOTE", "Cumplimiento",
                        {"nomina_id": nomina_id, "firmadas": firmadas})
    return {"status": "ok", "boletas_firmadas": firmadas}


@router.get("/boletas/mias")
def mis_boletas(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """
    Boletas del trabajador autenticado (todas sus nóminas), con su estado de firma.
    IDOR cerrado: solo devuelve detalles cuyo usuario_id coincide con el del token.
    """
    detalles = (
        db.query(DetalleNomina, Nomina)
        .join(Nomina, DetalleNomina.nomina_id == Nomina.id)
        .filter(
            DetalleNomina.usuario_id == usuario_actual.usuario_id,
            DetalleNomina.is_deleted.is_(False),
            Nomina.empresa_id == usuario_actual.empresa_id,
        )
        .order_by(Nomina.periodo.desc())
        .all()
    )
    salida = []
    for d, n in detalles:
        firma_emp = db.query(FirmaBoleta).filter(
            FirmaBoleta.detalle_id == d.id, FirmaBoleta.firmante == "empleado",
        ).first()
        firma_empresa = db.query(FirmaBoleta).filter(
            FirmaBoleta.detalle_id == d.id, FirmaBoleta.firmante == "empresa",
        ).first()
        salida.append({
            "detalle_id": d.id,
            "nomina_id": n.id,
            "periodo": n.periodo,
            "estado_nomina": n.estado,
            "sueldo_neto": float(d.sueldo_neto or 0),
            "firmada_empleado": firma_emp is not None,
            "firmada_empresa": firma_empresa is not None,
            "fecha_firma": firma_emp.fecha_firma if firma_emp else None,
        })
    return salida


@router.post("/boletas/{detalle_id}/firmar", response_model=FirmaResponse)
def firmar_mi_boleta(
    detalle_id: int,
    datos: FirmarBoletaRequest,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """
    El trabajador firma su boleta reconfirmando su credencial (PIN/token de usuario).
    Deja constancia legal de recepción, auditable por SUNAFIL. Cierra IDOR: la boleta
    debe pertenecer al usuario autenticado.
    """
    detalle = db.query(DetalleNomina).filter(
        DetalleNomina.id == detalle_id, DetalleNomina.is_deleted.is_(False),
    ).first()
    if not detalle:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
    if detalle.usuario_id != usuario_actual.usuario_id:
        raise HTTPException(status_code=403, detail="Solo puedes firmar tu propia boleta.")
    if not verificar_password(datos.password, usuario_actual.password_hash):
        raise HTTPException(status_code=401, detail="Credencial incorrecta.")

    ya = db.query(FirmaBoleta).filter(
        FirmaBoleta.detalle_id == detalle_id, FirmaBoleta.firmante == "empleado",
    ).first()
    if ya:
        return ya

    empleado = db.query(Empleado).filter(Empleado.usuario_id == usuario_actual.usuario_id).first()
    firma = FirmaBoleta(
        empresa_id=usuario_actual.empresa_id, detalle_id=detalle_id,
        empleado_id=empleado.empleado_id if empleado else None, firmante="empleado",
        hash_firma=_sello("empleado", str(detalle_id), usuario_actual.correo),
        ip=request.client.host if request.client else None,
    )
    db.add(firma)
    db.commit()
    db.refresh(firma)
    registrar_auditoria(db, usuario_actual.usuario_id, "FIRMAR_BOLETA", "Cumplimiento", {"detalle_id": detalle_id})
    return firma


@router.get("/boletas/{detalle_id}/firmas", response_model=List[FirmaResponse])
def listar_firmas(
    detalle_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    detalle = db.query(DetalleNomina).filter(DetalleNomina.id == detalle_id).first()
    if not detalle:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
    # Empleado solo ve las firmas de su propia boleta.
    if usuario_actual.rol not in ("Admin", "RRHH", "SuperAdmin") and detalle.usuario_id != usuario_actual.usuario_id:
        raise HTTPException(status_code=403, detail="No autorizado.")
    return db.query(FirmaBoleta).filter(FirmaBoleta.detalle_id == detalle_id).all()
