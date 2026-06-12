from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from src.database import get_db
from src.core.models import Usuario, Notificacion, AuditoriaProgramada
from src.core.security import verificar_password, crear_token_acceso
from src.core.dependencies import obtener_usuario_actual  # Inyectamos tu aduana
from src.core.schemas import (
    NotificacionCreate, NotificacionResponse,
    AuditoriaProgramadaCreate, AuditoriaProgramadaResponse
)

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
    
    token_acceso = crear_token_acceso(
        data={"sub": usuario.correo, "empresa_id": usuario.empresa_id},
        expires_delta=timedelta(minutes=60)
    )
    return {"access_token": token_acceso, "token_type": "bearer"}

# ENDPOINT DE PRUEBA: Si no mandas el token correcto, FastAPI lo rechazará automáticamente
@router.get("/usuarios/me")
def obtener_perfil_usuario(usuario_actual: Usuario = Depends(obtener_usuario_actual)):
    return {
        "usuario_id": usuario_actual.usuario_id,
        "nombre": usuario_actual.nombre,
        "correo": usuario_actual.correo,
        "rol": usuario_actual.rol,
        "empresa_id": usuario_actual.empresa_id
    }

# --- RUTAS DE NOTIFICACIONES ---

@router.post("/notificaciones", response_model=NotificacionResponse, status_code=status.HTTP_201_CREATED)
def crear_notificacion(
    notificacion: NotificacionCreate, 
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    nueva_notificacion = Notificacion(
        **notificacion.model_dump(),
        empresa_id=usuario_actual.empresa_id
    )
    db.add(nueva_notificacion)
    db.commit()
    db.refresh(nueva_notificacion)
    return nueva_notificacion

@router.get("/notificaciones", response_model=list[NotificacionResponse])
def listar_notificaciones(
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    # Solo devuelve notificaciones que pertenezcan a la empresa del usuario en sesión
    return db.query(Notificacion).filter(Notificacion.empresa_id == usuario_actual.empresa_id).all()

# --- RUTAS DE AUDITORÍAS PROGRAMADAS ---

@router.post("/auditorias", response_model=AuditoriaProgramadaResponse, status_code=status.HTTP_201_CREATED)
def crear_auditoria(
    auditoria: AuditoriaProgramadaCreate, 
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    nueva_auditoria = AuditoriaProgramada(
        **auditoria.model_dump(),
        empresa_id=usuario_actual.empresa_id
    )
    db.add(nueva_auditoria)
    db.commit()
    db.refresh(nueva_auditoria)
    return nueva_auditoria

@router.get("/auditorias", response_model=list[AuditoriaProgramadaResponse])
def listar_auditorias(
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    return db.query(AuditoriaProgramada).filter(AuditoriaProgramada.empresa_id == usuario_actual.empresa_id).all()