import os
import secrets

def generar_env():
    print("=== Generador de archivo .env Maestro ===")
    
    # Valores por defecto o autogenerados
    secret_key = secrets.token_hex(32)
    db_url_default = "postgresql://admin:password@localhost:5432/saas_db"
    
    print("\nPor favor, ingresa los siguientes valores (presiona Enter para usar el valor por defecto):")
    
    db_url = input(f"DATABASE_URL [{db_url_default}]: ") or db_url_default
    llm_key = input("LLM_API_KEY (Ej: tu-api-key-de-openai): ")
    zkteco_ip = input("ZKTECO_IP (Ej: 192.168.1.201): ")
    
    env_content = f"""# ==========================================
# Archivo de Configuración del Entorno (.env)
# ==========================================

# Base de Datos
DATABASE_URL={db_url}

# Seguridad y JWT
SECRET_KEY={secret_key}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Integración LLM (IA)
LLM_API_KEY={llm_key}

# Configuración Biométrica (ZKTeco)
ZKTECO_IP={zkteco_ip}
ZKTECO_PORT=4370

# Entorno
ENVIRONMENT=production
"""
    
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    
    # Comprobar si ya existe
    if os.path.exists(env_path):
        sobreescribir = input("\nEl archivo .env ya existe. ¿Deseas sobreescribirlo? (s/n): ")
        if sobreescribir.lower() != 's':
            print("Operación cancelada. No se modificó el archivo .env.")
            return

    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_content)
        
    print(f"\n¡Éxito! Archivo .env generado correctamente en: {env_path}")
    print("Recuerda NUNCA subir este archivo a tu repositorio (ya debería estar en .gitignore).")

if __name__ == "__main__":
    generar_env()
