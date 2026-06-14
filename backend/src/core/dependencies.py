from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from src.database import get_db
from src.core.models import Usuario
from src.core.security import SECRET_KEY, ALGORITHM

# Configura el esquema para que la interfaz Swagger muestre el candado de autenticación
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/core/login")

def obtener_usuario_actual(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    excepcion_credenciales = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar el token de acceso",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decodifica el token usando la firma secreta del servidor
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        correo: str = payload.get("sub")
        if correo is None:
            raise excepcion_credenciales
    except JWTError:
        raise excepcion_credenciales
        
    # Busca al dueño del token en la base de datos
    usuario = db.query(Usuario).filter(Usuario.correo == correo).first()
    if usuario is None:
        raise excepcion_credenciales
        
    return usuario

# NUEVO: Decorador de roles para proteger rutas
def verificar_rol(roles_permitidos: list[str]):
    def role_checker(usuario_actual: Usuario = Depends(obtener_usuario_actual)):
        if usuario_actual.rol not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta acción"
            )
        return usuario_actual
    return role_checker