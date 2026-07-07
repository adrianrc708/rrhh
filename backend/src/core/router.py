from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List, Optional
from pydantic import BaseModel
import json

from src.database import get_db
from src.core.models import Usuario
from src.core.security import verificar_password, crear_token_acceso, obtener_password_hash
from src.core.dependencies import obtener_usuario_actual, verificar_rol
from src.core.schemas import UsuarioCreate, UsuarioResponse, RegistroEmpresaCreate, NotificacionResponse
from src.core.models import Empresa, Notificacion, EventoAuditoria, Pago
from src.core.services import generar_alertas_proactivas

router = APIRouter()

# Precio por usuario activo / mes según plan (en soles, sin IGV) — debe coincidir con la calculadora de la landing page.
PRECIOS_PLAN = {"Micro": 12, "Estándar": 10, "Corporativo": 8}


# ==========================================
# AUTH
# ==========================================

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(
        Usuario.correo == form_data.username,
        Usuario.is_deleted.is_(False),
    ).first()
    if not usuario or not verificar_password(form_data.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = crear_token_acceso(
        data={"sub": usuario.correo, "empresa_id": usuario.empresa_id},
        expires_delta=timedelta(minutes=60),
    )
    return {"access_token": token, "token_type": "bearer"}


@router.get("/usuarios/me")
def perfil_usuario(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    # Fase 1: adjuntar el perfil de Empleado (si existe) para que el frontend pueda
    # enrutar por rol y para el cierre de IDOR (el Empleado conoce su propio id).
    from src.hr.models import Empleado
    empleado = db.query(Empleado).filter(
        Empleado.usuario_id == usuario_actual.usuario_id,
        Empleado.is_deleted.is_(False),
    ).first()
    return {
        "usuario_id": usuario_actual.usuario_id,
        "nombre": usuario_actual.nombre,
        "correo": usuario_actual.correo,
        "rol": usuario_actual.rol,
        "empresa_id": usuario_actual.empresa_id,
        "empleado_id": empleado.empleado_id if empleado else None,
        "jefe_id": empleado.jefe_id if empleado else None,
    }


# ==========================================
# RF-01: REGISTRO DE NUEVA EMPRESA AL SAAS
# ==========================================

class EmpresaRegistroRequest(BaseModel):
    # Datos de la empresa
    razon_social: str
    ruc: str
    plan_suscripcion: Optional[str] = "Básico"
    # Datos del admin de la empresa
    nombre_admin: str
    correo_admin: str
    password_admin: str


@router.post("/empresas/registro", status_code=status.HTTP_201_CREATED)
def registrar_empresa(datos: EmpresaRegistroRequest, db: Session = Depends(get_db)):
    """
    Endpoint público: permite que una nueva empresa se registre en la plataforma SaaS.
    Crea la empresa y el primer usuario Admin de esa empresa en una sola operación.
    """
    # Verificar que el RUC no esté registrado
    if db.query(Empresa).filter(Empresa.ruc == datos.ruc).first():
        raise HTTPException(status_code=409, detail="Ya existe una empresa con ese RUC")

    # Verificar que el correo del admin no esté en uso
    if db.query(Usuario).filter(Usuario.correo == datos.correo_admin).first():
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese correo")

    # Crear empresa
    empresa = Empresa(
        razon_social=datos.razon_social,
        ruc=datos.ruc,
        plan_suscripcion=datos.plan_suscripcion,
    )
    db.add(empresa)
    db.commit()
    db.refresh(empresa)

    # Crear usuario Admin de esa empresa
    admin = Usuario(
        empresa_id=empresa.empresa_id,
        nombre=datos.nombre_admin,
        correo=datos.correo_admin,
        password_hash=obtener_password_hash(datos.password_admin),
        rol="Admin",
        estado="Activo",
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    return {
        "mensaje": "Empresa registrada exitosamente",
        "empresa_id": empresa.empresa_id,
        "razon_social": empresa.razon_social,
        "admin_correo": admin.correo,
    }


# ==========================================
# NOTIFICACIONES
# ==========================================

@router.get("/notificaciones", response_model=List[NotificacionResponse])
def listar_notificaciones(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    notifs = db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_actual.usuario_id,
        Notificacion.is_deleted.is_(False),
    ).order_by(Notificacion.fecha_creacion.desc()).all()
    return notifs

@router.post("/notificaciones/verificar-contratos")
def trigger_alertas_proactivas(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),  # antes: sin auth
):
    creadas = generar_alertas_proactivas(db)
    return {"status": "ok", "notificaciones_creadas": creadas}


# ==========================================
# RF-16: AUDITORÍA
# ==========================================

@router.get("/auditoria")
def listar_eventos_auditoria(
    limite: int = 100,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    eventos = (
        db.query(EventoAuditoria, Usuario.nombre)
        .join(Usuario, EventoAuditoria.usuario_id == Usuario.usuario_id)
        .filter(Usuario.empresa_id == usuario_actual.empresa_id)
        .order_by(EventoAuditoria.fecha_evento.desc())
        .limit(limite)
        .all()
    )
    salida = []
    for ev, nombre in eventos:
        detalles = None
        if ev.detalles:
            try:
                detalles = json.loads(ev.detalles)
            except Exception:
                detalles = ev.detalles
        salida.append({
            "id": ev.id,
            "usuario": nombre,
            "accion": ev.accion,
            "modulo": ev.modulo,
            "detalles": detalles,
            "fecha_evento": ev.fecha_evento,
        })
    return salida


@router.get("/usuarios", response_model=List[UsuarioResponse])
def listar_usuarios(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    """Listado de todos los usuarios de la empresa (solo Admin)."""
    return db.query(Usuario).filter(
        Usuario.empresa_id == usuario_actual.empresa_id,
        Usuario.is_deleted.is_(False),
    ).all()


@router.post("/usuarios", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    datos: UsuarioCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    """Crea una nueva cuenta de usuario dentro de la misma empresa (solo Admin)."""
    ROLES_VALIDOS = {"Admin", "RRHH", "Gerente", "Empleado"}
    if datos.rol not in ROLES_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Opciones: {', '.join(ROLES_VALIDOS)}")

    if db.query(Usuario).filter(Usuario.correo == datos.correo).first():
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese correo.")

    nuevo = Usuario(
        empresa_id=usuario_actual.empresa_id,
        nombre=datos.nombre,
        correo=datos.correo,
        password_hash=obtener_password_hash(datos.password),
        rol=datos.rol,
        estado="Activo",
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.post("/registro", status_code=status.HTTP_201_CREATED)
def registrar_empresa(datos: RegistroEmpresaCreate, db: Session = Depends(get_db)):
    """Registro público: crea una nueva empresa, su usuario Admin y procesa el pago del plan elegido."""
    if datos.plan not in PRECIOS_PLAN:
        raise HTTPException(status_code=400, detail=f"Plan inválido. Opciones: {', '.join(PRECIOS_PLAN)}")
    if datos.num_empleados < 1:
        raise HTTPException(status_code=400, detail="El número de empleados debe ser al menos 1.")
    if datos.metodo_pago not in {"Tarjeta", "Yape", "Transferencia"}:
        raise HTTPException(status_code=400, detail="Método de pago inválido.")

    if db.query(Usuario).filter(Usuario.correo == datos.correo).first():
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo.")

    import uuid

    # Simulación de pasarela de pago: la tarjeta de prueba terminada en 0002 siempre es rechazada
    # (igual que la tarjeta de prueba estándar de Stripe/Niubiz), útil para probar el flujo de error.
    if datos.metodo_pago == "Tarjeta" and datos.tarjeta_ultimos4 == "0002":
        raise HTTPException(status_code=402, detail="Tu banco rechazó la transacción. Verifica los datos de tu tarjeta o usa otro método de pago.")

    monto = round(PRECIOS_PLAN[datos.plan] * datos.num_empleados, 2)

    empresa = Empresa(
        razon_social=datos.empresa_nombre,
        ruc=f"PEND-{uuid.uuid4().hex[:8].upper()}",
        plan_suscripcion=datos.plan,
    )
    db.add(empresa)
    db.flush()

    admin = Usuario(
        empresa_id=empresa.empresa_id,
        nombre=datos.nombre,
        correo=datos.correo,
        password_hash=obtener_password_hash(datos.password),
        rol="Admin",
        estado="Activo",
    )
    db.add(admin)
    db.flush()

    pago = Pago(
        empresa_id=empresa.empresa_id,
        plan=datos.plan,
        num_empleados=datos.num_empleados,
        monto=monto,
        metodo_pago=datos.metodo_pago,
        tarjeta_ultimos4=datos.tarjeta_ultimos4 if datos.metodo_pago == "Tarjeta" else None,
        referencia=f"OMN-{uuid.uuid4().hex[:10].upper()}",
        estado="Aprobado",
    )
    db.add(pago)
    db.commit()
    db.refresh(admin)
    db.refresh(pago)

    token = crear_token_acceso(
        data={"sub": admin.correo, "empresa_id": admin.empresa_id},
        expires_delta=timedelta(minutes=60),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {"nombre": admin.nombre, "correo": admin.correo, "rol": admin.rol},
        "pago": {
            "plan": pago.plan,
            "num_empleados": pago.num_empleados,
            "monto": float(pago.monto),
            "referencia": pago.referencia,
            "estado": pago.estado,
        },
    }
