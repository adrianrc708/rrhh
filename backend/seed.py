from src.database import engine, Base, SessionLocal
# Importamos todos los modelos relacionales para el mapeo correcto
from src.core.models import Empresa, Usuario, Nomina, DetalleNomina, HistorialAprobacion, EventoAuditoria, ParametroFiscal, HorasPeriodo
from src.hr.models import Empleado, Departamento, Cargo, Contrato
from src.attendance.models import Inasistencia, DispositivoKiosco, Marcacion
# Fase 5-7: importar los modelos nuevos para que create_all cree sus tablas.
from src.benefits.models import SolicitudAutogestion, BeneficioSocial, EvaluacionDesempeno
from src.compliance.models import LegajoDocumento, CertificadoDigital, FirmaBoleta
from src.infrastructure.models import LogTecnico
from src.saas.models import PermisosUsuario, Derechohabiente, SolicitudCambioDatos
from src.core.security import obtener_password_hash
from src.core.fiscal import PARAMETROS_DEFAULT, DESCRIPCIONES
from src.attendance import biometrics
from datetime import date, datetime, timedelta

from sqlalchemy import text

print("Creando tablas en PostgreSQL...")
Base.metadata.create_all(bind=engine)

# Asegurar que el campo estado exista en la tabla empresas
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE empresas ADD COLUMN estado VARCHAR(20) DEFAULT 'Activa';"))
except Exception:
    pass


# ── Migraciones ligeras idempotentes (Fases 5-7) ───────────────────────────────
# Columnas nuevas sobre tablas existentes. create_all no altera tablas ya creadas,
# así que se añaden aquí de forma segura (cada ALTER va en su propia transacción).
_ALTERS_IDEMPOTENTES = [
    # Fase 5: aprobación de sobretiempo por el Gerente sobre HorasPeriodo.
    "ALTER TABLE horas_periodo ADD COLUMN estado_aprobacion VARCHAR(15) DEFAULT 'Pendiente'",
    "ALTER TABLE horas_periodo ADD COLUMN aprobado_por INTEGER",
    "ALTER TABLE horas_periodo ADD COLUMN fecha_aprobacion TIMESTAMP",
    # Fase 6/7: datos maestros del empleado (exportadores legales + dispersión).
    "ALTER TABLE empleados ADD COLUMN tipo_documento VARCHAR(20) DEFAULT 'DNI'",
    "ALTER TABLE empleados ADD COLUMN numero_documento VARCHAR(20)",
    "ALTER TABLE empleados ADD COLUMN direccion VARCHAR(200)",
    "ALTER TABLE empleados ADD COLUMN banco VARCHAR(40)",
    "ALTER TABLE empleados ADD COLUMN cuenta_bancaria VARCHAR(30)",
    "ALTER TABLE empleados ADD COLUMN cci VARCHAR(30)",
    "ALTER TABLE empleados ADD COLUMN cuspp VARCHAR(20)",
]
for _sql in _ALTERS_IDEMPOTENTES:
    try:
        with engine.begin() as conn:
            conn.execute(text(_sql))
    except Exception:
        pass

db = SessionLocal()


def poblar_empresa_demo(db, razon_social, ruc, regimen, personas, plan="Corporativo"):
    """
    Crea una empresa completa con datos simulados en todos los módulos:
    departamentos/cargos, usuarios+empleados con línea de mando (jefe_id),
    contratos, marcaciones, inasistencias, sobretiempo, una nómina consolidada,
    solicitudes de autogestión y de cambio de datos. Idempotente por RUC.

    `personas`: lista de dicts {nombre, correo, password, rol, sueldo, perfil}.
    El primer Admin es el tope de la jerarquía; RRHH/Gerente cuelgan de él y los
    Empleados del Gerente.
    """
    if db.query(Empresa).filter(Empresa.ruc == ruc).first():
        return  # ya existe

    hoy = date.today()
    periodo = hoy.strftime("%Y-%m")

    empresa = Empresa(razon_social=razon_social, ruc=ruc, plan_suscripcion=plan, regimen_laboral=regimen)
    db.add(empresa); db.commit(); db.refresh(empresa)

    dep_admin = Departamento(empresa_id=empresa.empresa_id, nombre="Administración")
    dep_ops = Departamento(empresa_id=empresa.empresa_id, nombre="Operaciones")
    db.add_all([dep_admin, dep_ops]); db.commit(); db.refresh(dep_admin); db.refresh(dep_ops)

    cargo_dir = Cargo(departamento_id=dep_admin.departamento_id, nombre="Dirección")
    db.add(cargo_dir); db.commit(); db.refresh(cargo_dir)
    cargo_op = Cargo(departamento_id=dep_ops.departamento_id, nombre="Operario", parent_id=cargo_dir.cargo_id)
    db.add(cargo_op); db.commit(); db.refresh(cargo_op)

    admin_emp = gerente_emp = None
    empleados_emp = []
    for p in personas:
        u = Usuario(empresa_id=empresa.empresa_id, nombre=p["nombre"], correo=p["correo"],
                    password_hash=obtener_password_hash(p["password"]), rol=p["rol"], estado="Activo")
        db.add(u); db.commit(); db.refresh(u)
        es_admin_area = p["rol"] in ("Admin", "RRHH")
        emp = Empleado(
            usuario_id=u.usuario_id, nombre=p["nombre"], empresa_id=empresa.empresa_id,
            departamento_id=dep_admin.departamento_id if es_admin_area else dep_ops.departamento_id,
            cargo_id=cargo_dir.cargo_id if es_admin_area else cargo_op.cargo_id,
            tipo_pension=p.get("pension", "ONP"), estado="Activo",
            fecha_ingreso=hoy - timedelta(days=420),  # ~14 meses: genera meses computables
            numero_documento=p.get("dni"), tipo_documento="DNI",
            banco=p.get("banco"), cuenta_bancaria=p.get("cuenta"),
        )
        db.add(emp); db.commit(); db.refresh(emp)
        contrato = Contrato(
            empleado_id=emp.empleado_id, tipo_contrato="Indeterminado",
            perfil_contrato=p.get("perfil", "Comun"), sueldo_base=p["sueldo"],
            horas_contrato_mes=160, fecha_inicio=hoy - timedelta(days=420), estado="Vigente",
        )
        db.add(contrato)
        if p["rol"] == "Admin":
            admin_emp = emp
        elif p["rol"] == "Gerente":
            gerente_emp = emp
        elif p["rol"] == "Empleado":
            empleados_emp.append(emp)
    db.commit()

    # Línea de mando (jefe_id): Admin al tope; RRHH/Gerente -> Admin; Empleados -> Gerente.
    if admin_emp:
        for u in db.query(Usuario).filter(Usuario.empresa_id == empresa.empresa_id, Usuario.rol.in_(["RRHH", "Gerente"])).all():
            e = db.query(Empleado).filter(Empleado.usuario_id == u.usuario_id).first()
            if e:
                e.jefe_id = admin_emp.empleado_id
    jefe_de_emps = gerente_emp or admin_emp
    if jefe_de_emps:
        for e in empleados_emp:
            e.jefe_id = jefe_de_emps.empleado_id
    db.commit()

    # ── Datos simulados por módulo ──────────────────────────────────────────
    registrados = [e for e in empleados_emp] or ([gerente_emp] if gerente_emp else [])
    for idx, e in enumerate(registrados):
        # Marcaciones de los últimos 3 días (entrada + salida)
        for d in range(1, 4):
            dia = hoy - timedelta(days=d)
            for tipo, hora in (("entrada", 8), ("salida", 17)):
                db.add(Marcacion(
                    empresa_id=empresa.empresa_id, empleado_id=e.empleado_id, tipo=tipo,
                    momento=datetime(dia.year, dia.month, dia.day, hora, 0), fecha=dia,
                    periodo=dia.strftime("%Y-%m"), origen="kiosco",
                ))
        # Una inasistencia justificada y sobretiempo pendiente de aprobar
        db.add(Inasistencia(
            empleado_id=e.empleado_id, empresa_id=empresa.empresa_id,
            fecha=hoy - timedelta(days=5), tipo="Justificada", horas_ausentes=8,
            periodo=periodo, observaciones="Cita médica",
        ))
        db.add(HorasPeriodo(
            empresa_id=empresa.empresa_id, empleado_id=e.empleado_id, periodo=periodo,
            horas_extra_25=6 + idx, horas_extra_35=2, horas_nocturnas=4,
            estado_aprobacion="Pendiente",
        ))
    db.commit()

    # Una solicitud de autogestión pendiente (primer empleado -> su jefe)
    if empleados_emp:
        e0 = empleados_emp[0]
        db.add(SolicitudAutogestion(
            empresa_id=empresa.empresa_id, empleado_id=e0.empleado_id, tipo="Vacaciones",
            fecha_inicio=hoy + timedelta(days=15), fecha_fin=hoy + timedelta(days=22), dias=8,
            con_goce=True, motivo="Descanso anual", aprobador_id=e0.jefe_id, estado="Pendiente",
        ))
        # Una solicitud de cambio de datos pendiente (para RRHH)
        import json as _json
        db.add(SolicitudCambioDatos(
            empresa_id=empresa.empresa_id, empleado_id=e0.empleado_id, tipo_cambio="Bancario",
            payload=_json.dumps({"banco": "Interbank", "cuenta_bancaria": "8983000112223", "cci": "00389800011122230145"}),
            estado="Pendiente",
        ))
    db.commit()

    # Nómina del periodo actual, consolidada (genera boletas reales)
    try:
        from src.payroll.services import consolidar_nomina
        nomina = Nomina(empresa_id=empresa.empresa_id, periodo=periodo, estado="Borrador")
        db.add(nomina); db.commit(); db.refresh(nomina)
        consolidar_nomina(db, nomina, empresa.empresa_id)
    except Exception as ex:  # noqa: BLE001 — la nómina simulada no debe romper el seed
        print(f"  (aviso) no se pudo consolidar la nómina demo de {razon_social}: {ex}")
        db.rollback()

    # Dispositivo kiosco demo por empresa (token conocido para pruebas)
    db.add(DispositivoKiosco(
        empresa_id=empresa.empresa_id, nombre="Tablet Recepción",
        token_hash=biometrics.hash_secreto("demo"), pin_hash=biometrics.hash_secreto("1234"),
    ))
    db.commit()
    print(f"  Empresa demo '{razon_social}' poblada (RUC {ruc}, régimen {regimen}).")

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

    # ── Empresas cliente adicionales con datos simulados (idempotente por RUC) ──
    # Se crean aunque la BD ya tuviera datos, para poblar el panel del SuperAdmin.
    poblar_empresa_demo(
        db, "Innova Perú S.A.C.", "20555000111", "General",
        [
            {"nombre": "Adrian Rivera",   "correo": "adrian@innova.com",    "password": "innova123", "rol": "Admin",    "sueldo": 6000, "dni": "40111222", "banco": "BCP",       "cuenta": "1911000100200"},
            {"nombre": "Emanuel Cabeza",  "correo": "emanuel@innova.com",   "password": "innova123", "rol": "RRHH",     "sueldo": 3400, "dni": "40222333"},
            {"nombre": "Roberto Vegas",   "correo": "roberto@innova.com",   "password": "innova123", "rol": "Gerente",  "sueldo": 4800, "dni": "40333444"},
            {"nombre": "Gabriel Tang",    "correo": "gabriel@innova.com",   "password": "innova123", "rol": "Empleado", "sueldo": 2600, "dni": "40444555", "banco": "BBVA", "cuenta": "0011002233445"},
            {"nombre": "Alexander Soto",  "correo": "alexander@innova.com", "password": "innova123", "rol": "Empleado", "sueldo": 2400, "dni": "40555666"},
        ],
    )
    poblar_empresa_demo(
        db, "Constructora Andina E.I.R.L.", "20555000222", "MYPE_Pequena",
        [
            {"nombre": "Lucía Fernández", "correo": "lucia@andina.com",  "password": "andina123", "rol": "Admin",    "sueldo": 5200, "dni": "41111000"},
            {"nombre": "Pedro Salas",     "correo": "pedro@andina.com",  "password": "andina123", "rol": "RRHH",     "sueldo": 3000, "dni": "41222000"},
            {"nombre": "Diana Quispe",    "correo": "diana@andina.com",  "password": "andina123", "rol": "Gerente",  "sueldo": 4200, "dni": "41333000"},
            {"nombre": "Marco Ríos",      "correo": "marco@andina.com",  "password": "andina123", "rol": "Empleado", "sueldo": 1500, "dni": "41444000", "perfil": "Construccion"},
        ],
        plan="Estándar",
    )

db.close()