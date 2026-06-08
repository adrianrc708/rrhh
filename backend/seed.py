from src.database import engine, Base, SessionLocal
from src.core.models import Empresa, Usuario
from src.core.security import obtener_password_hash

# 1. Crear las tablas en la base de datos
print("Creando tablas en PostgreSQL...")
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# 2. Insertar datos de prueba si la base de datos está vacía
if not db.query(Empresa).first():
    print("Insertando Empresa y Usuario de prueba...")
    nueva_empresa = Empresa(
        razon_social="Tech SA", 
        ruc="20123456789", 
        plan_suscripcion="Premium"
    )
    db.add(nueva_empresa)
    db.commit()
    db.refresh(nueva_empresa)

    nuevo_usuario = Usuario(
        empresa_id=nueva_empresa.empresa_id,
        nombre="Adrian Admin",
        correo="admin@tech.com",
        password_hash=obtener_password_hash("admin123"),
        rol="Admin"
    )
    db.add(nuevo_usuario)
    db.commit()
    print("¡Datos creados con éxito! Correo: admin@tech.com / Pass: admin123")
else:
    print("Las tablas ya existen y tienen datos.")

db.close()