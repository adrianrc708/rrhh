from src.core.security import (
    obtener_password_hash, 
    verificar_password, 
    cifrar_dato_aes, 
    descifrar_dato_aes
)

print("=== 1. PRUEBA DE CONTRASEÑAS (BCRYPT) ===")
mi_password = "mi_clave_secreta"
hash_generado = obtener_password_hash(mi_password)

print(f"Password original: {mi_password}")
print(f"Hash generado: {hash_generado}")
print(f"¿Verificación exitosa?: {verificar_password('mi_clave_secreta', hash_generado)}")
print(f"¿Rechaza claves falsas?: {verificar_password('clave_falsa', hash_generado)}")


print("\n=== 2. PRUEBA DE CIFRADO (AES-256) ===")
texto_sensible = "CredencialesZKTeco123"
texto_cifrado = cifrar_dato_aes(texto_sensible)
texto_descifrado = descifrar_dato_aes(texto_cifrado)

print(f"Texto original: {texto_sensible}")
print(f"Texto encriptado: {texto_cifrado}")
print(f"Texto recuperado: {texto_descifrado}")