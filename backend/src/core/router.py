from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from src.database import get_db
from src.core.models import Usuario
from src.core.security import verificar_password, crear_token_acceso
from src.core.dependencies import obtener_usuario_actual  # Inyectamos tu aduana

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