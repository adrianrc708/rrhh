from src.database import engine, Base, SessionLocal
# Importamos todos los modelos relacionales para el mapeo correcto
from src.core.models import Empresa, Usuario, Nomina, DetalleNomina, HistorialAprobacion, EventoAuditoria, ParametroFiscal
from src.hr.models import Empleado, Departamento, Cargo, Contrato
from src.attendance.models import Inasistencia, DispositivoKiosco
from src.core.security import obtener_password_hash
from src.core.fiscal import PARAMETROS_DEFAULT, DESCRIPCIONES
from src.attendance import biometrics
from datetime import date

from sqlalchemy import text

print("Creando tablas en PostgreSQL...")
Base.metadata.create_all(bind=engine)

# Asegurar que el campo estado exista en la tabla empresas
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE empresas ADD COLUMN estado VARCHAR(20) DEFAULT 'Activa';"))
except Exception:
    pass

db = SessionLocal()

if not db.query(Empresa).first():
    print("Insertando datos de prueba relacionales...")

    # 1. Crear Empresa base
    empresa = Empresa(razon_social="Tech SA", ruc="20123456789", plan_suscripcion="Corporativo")
    db.add(empresa)
    db.commit()
    db.refresh(empresa)

    # 2. Crear Usuarios globales (Cuentas de acceso)
    usuarios = [
        Usuario(empresa_id=empresa.empresa_id, nombre="Emanuel",
                correo="superadmin@tech.com", password_hash=obtener_password_hash("superadmin123"), rol="SuperAdmin"),
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
    dept_ops = Departamento(empresa_id=empresa.empresa_id, nombre="Operaciones")
    db.add_all([dept_rrhh, dept_ops])
    db.commit()
    db.refresh(dept_rrhh)
    db.refresh(dept_ops)

    # 4. Estructurar Árbol Corporativo: Cargos vinculados con JERARQUÍA DE MANDO (RF-04 Corregido)
    cargo_gerente = Cargo(departamento_id=dept_ops.departamento_id, nombre="Gerente de Operaciones", parent_id=None)
    db.add(cargo_gerente)
    db.commit()
    db.refresh(cargo_gerente)

    cargo_analista = Cargo(departamento_id=dept_rrhh.departamento_id, nombre="Analista RRHH", parent_id=None)
    cargo_operario = Cargo(departamento_id=dept_ops.departamento_id, nombre="Operario", parent_id=cargo_gerente.cargo_id) # Jerarquía: Reporta al Gerente
    db.add_all([cargo_analista, cargo_operario])
    db.commit()
    db.refresh(cargo_analista)
    db.refresh(cargo_operario)

    # 5. Crear perfiles de empleado mapeados y sus contratos históricos para TODOS los usuarios (RF-05 y RF-06)
    empleados_por_rol = {}  # Fase 1: para cablear la línea de mando (jefe_id) luego
    for u in usuarios:
        if u.rol == "SuperAdmin":
            continue # El SuperAdmin no es un empleado de la empresa
            
        if u.rol == "Admin":
            d_id = dept_rrhh.departamento_id
            c_id = cargo_analista.cargo_id
            sueldo = 5000.00
            tipo_c = "Indeterminado"
        elif u.rol == "RRHH":
            d_id = dept_rrhh.departamento_id
            c_id = cargo_analista.cargo_id
            sueldo = 3000.00
            tipo_c = "Plazo Fijo"
        elif u.rol == "Gerente":
            d_id = dept_ops.departamento_id
            c_id = cargo_gerente.cargo_id
            sueldo = 4500.00
            tipo_c = "Indeterminado"
        else: # Empleado
            d_id = dept_ops.departamento_id
            c_id = cargo_operario.cargo_id
            sueldo = 2200.00
            tipo_c = "Plazo Fijo"

        # Guardamos el perfil inyectando explícitamente el nombre del usuario
        emp = Empleado(
            usuario_id=u.usuario_id,
            nombre=u.nombre, # Soluciona el problema de "Colaborador X"
            empresa_id=empresa.empresa_id,
            departamento_id=d_id,
            cargo_id=c_id,
            tipo_pension="ONP",
            fecha_ingreso=date.today(),
            estado="Activo"
        )
        db.add(emp)
        db.commit()
        db.refresh(emp)
        empleados_por_rol[u.rol] = emp

        # Contrato asociado obligatorio
        contrato = Contrato(
            empleado_id=emp.empleado_id,
            tipo_contrato=tipo_c,
            sueldo_base=sueldo,
            horas_contrato_mes=160,
            fecha_inicio=date.today(),
            estado="Vigente"
        )
        db.add(contrato)

    db.commit()

    # 5.b Cablear la línea de mando (Fase 1): Admin (tope) → RRHH/Gerente → Empleado.
    #     Con esto, el Gerente solo verá el subárbol bajo él (Maria Empleada).
    admin_emp = empleados_por_rol.get("Admin")
    gerente_emp = empleados_por_rol.get("Gerente")
    if admin_emp:
        if empleados_por_rol.get("RRHH"):
            empleados_por_rol["RRHH"].jefe_id = admin_emp.empleado_id
        if gerente_emp:
            gerente_emp.jefe_id = admin_emp.empleado_id
    if gerente_emp and empleados_por_rol.get("Empleado"):
        empleados_por_rol["Empleado"].jefe_id = gerente_emp.empleado_id
    db.commit()

    print("¡Estructura relacional de Recursos Humanos poblada con éxito!")
    print("Cuentas de prueba listas para usar:")
    print("  Super Admin: superadmin@tech.com / superadmin123")
    print("  Admin:    admin@tech.com    / admin123")
    print("  RRHH:     rrhh@tech.com     / rrhh123")
    print("  Gerente:  gerente@tech.com  / gerente123")
    print("  Empleado: empleada@tech.com / emp123")
else:
    print("Las tablas ya tienen datos. Verificando Super Admin...")
    empresa = db.query(Empresa).first()
    if empresa:
        su_admin = db.query(Usuario).filter_by(correo="superadmin@tech.com").first()
        if not su_admin:
            su_admin = Usuario(empresa_id=empresa.empresa_id, nombre="Emanuel", correo="superadmin@tech.com", password_hash=obtener_password_hash("superadmin123"), rol="SuperAdmin")
            db.add(su_admin)
            db.commit()
            print("¡Super Admin inyectado en la base de datos existente!")
        else:
            su_admin.rol = "SuperAdmin"
            su_admin.password_hash = obtener_password_hash("superadmin123")
            db.commit()
            print("¡Super Admin actualizado a rol SuperAdmin!")
    else:
        print("No se insertó nada extra.")

# ── Seeds idempotentes (se ejecutan tanto en BD nueva como existente) ──────────
empresa = db.query(Empresa).first()
if empresa:
    # Parámetros fiscales por defecto (RMV/UIT/tasas + sectoriales), vigentes desde 2024.
    if not db.query(ParametroFiscal).first():
        for clave, valor in PARAMETROS_DEFAULT.items():
            db.add(ParametroFiscal(
                clave=clave,
                valor=valor,
                descripcion=DESCRIPCIONES.get(clave),
                vigencia_desde=date(2024, 1, 1),
                vigencia_hasta=None,
                activo=True,
            ))
        db.commit()
        print("Parámetros fiscales por defecto insertados (RMV, UIT, tasas, sectoriales).")

    # Dispositivo kiosco demo (Fase 3) con token/PIN conocidos para pruebas.
    if not db.query(DispositivoKiosco).first():
        dispositivo = DispositivoKiosco(
            empresa_id=empresa.empresa_id,
            nombre="Tablet Demo (Puerta Principal)",
            token_hash=biometrics.hash_secreto("demo"),
            pin_hash=biometrics.hash_secreto("1234"),
        )
        db.add(dispositivo)
        db.commit()
        db.refresh(dispositivo)
        print(f"Kiosco demo listo → Token: {dispositivo.dispositivo_id}.demo  |  PIN: 1234")

db.close()