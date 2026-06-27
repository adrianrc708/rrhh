from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel
from typing import Optional

from src.database import get_db
from src.core.models import Usuario, Empresa, Notificacion, EventoAuditoria
from src.core.security import verificar_password, crear_token_acceso, obtener_password_hash
from src.core.dependencies import obtener_usuario_actual, verificar_rol
from src.core.services import verificar_vencimiento_contratos
from typing import List
from src.core.schemas import NotificacionResponse
import json

router = APIRouter()


# ==========================================
# AUTH
# ==========================================

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.correo == form_data.username).first()
    if not usuario or not verificar_password(form_data.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = crear_token_acceso(
        data={"sub": usuario.correo, "empresa_id": usuario.empresa_id},
        expires_delta=timedelta(minutes=60),
    )
    return {"access_token": token, "token_type": "bearer"}


@router.get("/usuarios/me")
def perfil_usuario(usuario_actual: Usuario = Depends(obtener_usuario_actual)):
    return {
        "usuario_id": usuario_actual.usuario_id,
        "nombre": usuario_actual.nombre,
        "correo": usuario_actual.correo,
        "rol": usuario_actual.rol,
        "empresa_id": usuario_actual.empresa_id,
    }


# ==========================================
# RF-01: REGISTRO DE NUEVA EMPRESA AL SAAS
# ==========================================

class EmpresaRegistroRequest(BaseModel):
    # Datos de la empresa
    razon_social: str
    ruc: str
    plan_suscripcion: Optional[str] = "Básico"
    # Datos del admin de la empresa
    nombre_admin: str
    correo_admin: str
    password_admin: str


@router.post("/empresas/registro", status_code=status.HTTP_201_CREATED)
def registrar_empresa(datos: EmpresaRegistroRequest, db: Session = Depends(get_db)):
    """
    Endpoint público: permite que una nueva empresa se registre en la plataforma SaaS.
    Crea la empresa y el primer usuario Admin de esa empresa en una sola operación.
    """
    # Verificar que el RUC no esté registrado
    if db.query(Empresa).filter(Empresa.ruc == datos.ruc).first():
        raise HTTPException(status_code=409, detail="Ya existe una empresa con ese RUC")

    # Verificar que el correo del admin no esté en uso
    if db.query(Usuario).filter(Usuario.correo == datos.correo_admin).first():
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese correo")

    # Crear empresa
    empresa = Empresa(
        razon_social=datos.razon_social,
        ruc=datos.ruc,
        plan_suscripcion=datos.plan_suscripcion,
    )
    db.add(empresa)
    db.commit()
    db.refresh(empresa)

    # Crear usuario Admin de esa empresa
    admin = Usuario(
        empresa_id=empresa.empresa_id,
        nombre=datos.nombre_admin,
        correo=datos.correo_admin,
        password_hash=obtener_password_hash(datos.password_admin),
        rol="Admin",
        estado="Activo",
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    return {
        "mensaje": "Empresa registrada exitosamente",
        "empresa_id": empresa.empresa_id,
        "razon_social": empresa.razon_social,
        "admin_correo": admin.correo,
    }


# ==========================================
# NOTIFICACIONES
# ==========================================

@router.get("/notificaciones", response_model=List[NotificacionResponse])
def listar_notificaciones(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    notifs = db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_actual.usuario_id
    ).order_by(Notificacion.fecha_creacion.desc()).all()
    return notifs

@router.post("/notificaciones/verificar-contratos")
def trigger_verificar_contratos(db: Session = Depends(get_db)):
    creadas = verificar_vencimiento_contratos(db)
    return {"status": "ok", "notificaciones_creadas": creadas}


# ==========================================
# RF-16: AUDITORÍA
# ==========================================

@router.get("/auditoria")
def listar_eventos_auditoria(
    limite: int = 100,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    eventos = (
        db.query(EventoAuditoria, Usuario.nombre)
        .join(Usuario, EventoAuditoria.usuario_id == Usuario.usuario_id)
        .filter(Usuario.empresa_id == usuario_actual.empresa_id)
        .order_by(EventoAuditoria.fecha_evento.desc())
        .limit(limite)
        .all()
    )
    salida = []
    for ev, nombre in eventos:
        detalles = None
        if ev.detalles:
            try:
                detalles = json.loads(ev.detalles)
            except Exception:
                detalles = ev.detalles
        salida.append({
            "id": ev.id,
            "usuario": nombre,
            "accion": ev.accion,
            "modulo": ev.modulo,
            "detalles": detalles,
            "fecha_evento": ev.fecha_evento,
        })
    return salida