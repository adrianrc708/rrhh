from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List

from src.database import get_db
from src.core.models import Usuario
from src.core.security import verificar_password, crear_token_acceso, obtener_password_hash
from src.core.dependencies import obtener_usuario_actual, verificar_rol
from src.core.schemas import UsuarioCreate, UsuarioResponse, RegistroEmpresaCreate
from src.core.models import Empresa

router = APIRouter()


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

from src.core.models import Notificacion, EventoAuditoria
from src.core.services import verificar_vencimiento_contratos
from typing import List
from src.core.schemas import NotificacionResponse
import json

@router.get("/notificaciones", response_model=List[NotificacionResponse])
def listar_notificaciones(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    notifs = db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_actual.usuario_id
    ).order_by(Notificacion.fecha_creacion.desc()).all()
    
    # Adaptar para que devuelva pydantic schema (Pydantic usa booleans, DB usa Boolean ahora)
    return notifs

@router.post("/notificaciones/verificar-contratos")
def trigger_verificar_contratos(db: Session = Depends(get_db)):
    """
    Endpoint manual para generar notificaciones de vencimiento de contratos.
    También será ejecutado periódicamente por el cronjob.
    """
    creadas = verificar_vencimiento_contratos(db)
    return {"status": "ok", "notificaciones_creadas": creadas}


@router.get("/auditoria")
def listar_eventos_auditoria(
    limite: int = 100,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """Registro de auditoría: acciones de los usuarios de la empresa (RF-16)."""
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


@router.get("/usuarios", response_model=List[UsuarioResponse])
def listar_usuarios(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    """Listado de todos los usuarios de la empresa (solo Admin)."""
    return db.query(Usuario).filter(Usuario.empresa_id == usuario_actual.empresa_id).all()


@router.post("/usuarios", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    datos: UsuarioCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    """Crea una nueva cuenta de usuario dentro de la misma empresa (solo Admin)."""
    ROLES_VALIDOS = {"Admin", "RRHH", "Gerente", "Empleado"}
    if datos.rol not in ROLES_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Opciones: {', '.join(ROLES_VALIDOS)}")

    if db.query(Usuario).filter(Usuario.correo == datos.correo).first():
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese correo.")

    nuevo = Usuario(
        empresa_id=usuario_actual.empresa_id,
        nombre=datos.nombre,
        correo=datos.correo,
        password_hash=obtener_password_hash(datos.password),
        rol=datos.rol,
        estado="Activo",
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.post("/registro", status_code=status.HTTP_201_CREATED)
def registrar_empresa(datos: RegistroEmpresaCreate, db: Session = Depends(get_db)):
    """Registro público: crea una nueva empresa y su usuario Admin."""
    if db.query(Usuario).filter(Usuario.correo == datos.correo).first():
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo.")

    import uuid
    empresa = Empresa(
        razon_social=datos.empresa_nombre,
        ruc=f"PEND-{uuid.uuid4().hex[:8].upper()}",
        plan_suscripcion="Micro",
    )
    db.add(empresa)
    db.flush()

    admin = Usuario(
        empresa_id=empresa.empresa_id,
        nombre=datos.nombre,
        correo=datos.correo,
        password_hash=obtener_password_hash(datos.password),
        rol="Admin",
        estado="Activo",
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    token = crear_token_acceso(
        data={"sub": admin.correo, "empresa_id": admin.empresa_id},
        expires_delta=timedelta(minutes=60),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {"nombre": admin.nombre, "correo": admin.correo, "rol": admin.rol},
    }
