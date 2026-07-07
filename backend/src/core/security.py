from passlib.context import CryptContext
from cryptography.fernet import Fernet
from jose import jwt
from datetime import datetime, timedelta
import os

# 1. Hashing de Contraseñas (Bcrypt es el estándar seguro)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verificar_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def obtener_password_hash(password):
    return pwd_context.hash(password)

# 2. Cifrado AES-256 para datos sensibles (Requerimiento del documento)
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
cipher_suite = Fernet(ENCRYPTION_KEY.encode())

def cifrar_dato_aes(dato_texto: str) -> str:
    return cipher_suite.encrypt(dato_texto.encode()).decode()

def descifrar_dato_aes(dato_cifrado: str) -> str:
    return cipher_suite.decrypt(dato_cifrado.encode()).decode()

# 3. Generación de Token JWT para el Login
SECRET_KEY = os.getenv("SECRET_KEY", "tu_llave_secreta_jwt_aqui")
ALGORITHM = "HS256"

def crear_token_acceso(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)