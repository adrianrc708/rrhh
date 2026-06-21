from src.database import engine, Base, SessionLocal
# Importar todos los modelos para que create_all los registre
from src.core.models import Empresa, Usuario, Nomina, DetalleNomina, HistorialAprobacion, EventoAuditoria
from src.hr.models import Empleado
from src.attendance.models import Inasistencia
from src.core.security import obtener_password_hash

print("Creando tablas en PostgreSQL...")
Base.metadata.create_all(bind=engine)

db = SessionLocal()

if not db.query(Empresa).first():
    print("Insertando datos de prueba...")

    empresa = Empresa(razon_social="Tech SA", ruc="20123456789", plan_suscripcion="Premium")
    db.add(empresa)
    db.commit()
    db.refresh(empresa)

    usuarios = [
        Usuario(empresa_id=empresa.empresa_id, nombre="Adrian Admin",
                correo="admin@tech.com", password_hash=obtener_password_hash("admin123"), rol="Admin"),
        Usuario(empresa_id=empresa.empresa_id, nombre="Carmen RRHH",
                correo="rrhh@tech.com", password_hash=obtener_password_hash("rrhh123"), rol="RRHH"),
        Usuario(empresa_id=empresa.empresa_id, nombre="Luis Gerente",
                correo="gerente@tech.com", password_hash=obtener_password_hash("gerente123"), rol="Gerente"),
        Usuario(empresa_id=empresa.empresa_id, nombre="Maria Empleada",
                correo="empleada@tech.com", password_hash=obtener_password_hash("emp123"), rol="Empleado"),
    ]
    db.add_all(usuarios)
    db.commit()
    for u in usuarios:
        db.refresh(u)

    # Crear perfiles de empleado para los usuarios que no son Admin/Gerente
    empleados_usuarios = [u for u in usuarios if u.rol in ("RRHH", "Empleado")]
    for u in empleados_usuarios:
        db.add(Empleado(
            usuario_id=u.usuario_id,
            empresa_id=empresa.empresa_id,
            sueldo_base=3000.00 if u.rol == "RRHH" else 2200.00,
            horas_contrato_mes=160,
            tipo_pension="ONP",
            cargo="Analista RRHH" if u.rol == "RRHH" else "Operario",
            departamento="Recursos Humanos" if u.rol == "RRHH" else "Operaciones",
        ))
    db.commit()

    print("Datos de prueba creados:")
    print("  Admin:    admin@tech.com    / admin123")
    print("  RRHH:     rrhh@tech.com     / rrhh123")
    print("  Gerente:  gerente@tech.com  / gerente123")
    print("  Empleado: empleada@tech.com / emp123")
else:
    print("Las tablas ya tienen datos. No se insertó nada.")

db.close()
