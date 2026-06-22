from src.database import engine, Base, SessionLocal
# Importamos todos los modelos relacionales para el mapeo correcto
from src.core.models import Empresa, Usuario, Nomina, DetalleNomina, HistorialAprobacion, EventoAuditoria
from src.hr.models import Empleado, Departamento, Cargo, Contrato
from src.attendance.models import Inasistencia
from src.core.security import obtener_password_hash
from datetime import date

print("Creando tablas en PostgreSQL...")
Base.metadata.create_all(bind=engine)

db = SessionLocal()

if not db.query(Empresa).first():
    print("Insertando datos de prueba relacionales...")

    # 1. Crear Empresa base
    empresa = Empresa(razon_social="Tech SA", ruc="20123456789", plan_suscripcion="Premium")
    db.add(empresa)
    db.commit()
    db.refresh(empresa)

    # 2. Crear Usuarios globales (Cuentas de acceso)
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

   # 3. Estructurar Árbol Corporativo: Departamentos (RF-04)
    dept_rrhh = Departamento(empresa_id=empresa.empresa_id, nombre="Recursos Humanos")
    dept_ops = Departamento(empresa_id=empresa.empresa_id, nombre="Operaciones") # ← Corregido aquí (sin module_name)
    db.add_all([dept_rrhh, dept_ops])
    db.commit()
    db.refresh(dept_rrhh)
    db.refresh(dept_ops)

    # 4. Estructurar Árbol Corporativo: Cargos vinculados (RF-04)
    cargo_analista = Cargo(departamento_id=dept_rrhh.departamento_id, nombre="Analista RRHH")
    cargo_operario = Cargo(departamento_id=dept_ops.departamento_id, nombre="Operario")
    db.add_all([cargo_analista, cargo_operario])
    db.commit()
    db.refresh(cargo_analista)
    db.refresh(cargo_operario)

    # 5. Crear perfiles de empleado mapeados y sus contratos históricos (RF-05 y RF-06)
    for u in usuarios:
        if u.rol == "RRHH":
            emp = Empleado(
                usuario_id=u.usuario_id,
                empresa_id=empresa.empresa_id,
                departamento_id=dept_rrhh.departamento_id,
                cargo_id=cargo_analista.cargo_id,
                tipo_pension="ONP",
                fecha_ingreso=date.today(),
                estado="Activo"
            )
            db.add(emp)
            db.commit()
            db.refresh(emp)

            # Contrato asociado al empleado
            contrato = Contrato(
                empleado_id=emp.empleado_id,
                tipo_contrato="Plazo Fijo",
                sueldo_base=3000.00,
                horas_contrato_mes=160,
                fecha_inicio=date.today(),
                estado="Vigente"
            )
            db.add(contrato)

        elif u.rol == "Empleado":
            emp = Empleado(
                usuario_id=u.usuario_id,
                empresa_id=empresa.empresa_id,
                departamento_id=dept_ops.departamento_id,
                cargo_id=cargo_operario.cargo_id,
                tipo_pension="ONP",
                fecha_ingreso=date.today(),
                estado="Activo"
            )
            db.add(emp)
            db.commit()
            db.refresh(emp)

            # Contrato asociado al empleado
            contrato = Contrato(
                empleado_id=emp.empleado_id,
                tipo_contrato="Indeterminado",
                sueldo_base=2200.00,
                horas_contrato_mes=160,
                fecha_inicio=date.today(),
                estado="Vigente"
            )
            db.add(contrato)

    db.commit()

    print("¡Estructura relacional de Recursos Humanos poblada con éxito!")
    print("Cuentas de prueba listas para usar:")
    print("  Admin:    admin@tech.com    / admin123")
    print("  RRHH:     rrhh@tech.com     / rrhh123")
    print("  Gerente:  gerente@tech.com  / gerente123")
    print("  Empleado: empleada@tech.com / emp123")
else:
    print("Las tablas ya tienen datos. No se insertó nada.")

db.close()