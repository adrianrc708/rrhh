"""
Fase 7 — Router de administración del SaaS y permisos.

  · Facturación propia (Admin): plan, historial de pagos, factura y renovación.
  · Roles personalizados por sección (Admin): override de accesos por usuario.
  · Datos maestros del empleado: solicitud de cambio (bancario/domicilio/
    derechohabientes) enrutada a RRHH, que la aprueba y aplica.
"""
import json
import uuid
from datetime import datetime, date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.models import Usuario, Empresa, Pago
from src.core.dependencies import obtener_usuario_actual, verificar_rol, obtener_empleado_actual
from src.core.services import crear_notificacion, registrar_auditoria
from src.hr.models import Empleado
from src.saas.models import PermisosUsuario, Derechohabiente, SolicitudCambioDatos, TIPOS_CAMBIO
from src.saas.schemas import (
    FacturacionResponse, PagoItem, PagarRequest,
    PermisosUsuarioResponse, SetPermisosRequest,
    MisDatosResponse, DerechohabienteItem, SolicitudCambioCreate,
    SolicitudCambioResponse, ResolverCambioRequest,
)

router = APIRouter()

# Secciones válidas (deben coincidir con SectionKey del frontend en auth/roles.ts).
VALID_SECCIONES = {
    "dashboard", "personal", "organigrama", "asistencia", "nomina", "beneficios",
    "aprobaciones", "cumplimiento", "auditoria", "admin", "mi-espacio", "configuracion",
}

# Precio por usuario/mes por plan (coincide con core.router.PRECIOS_PLAN).
PRECIOS_PLAN = {"Micro": 12, "Estándar": 10, "Corporativo": 8, "Premium": 8, "Básico": 12}


def _nombre_empleado(db: Session, empleado_id: int) -> str:
    e = db.query(Empleado).filter(Empleado.empleado_id == empleado_id).first()
    if e and e.nombre:
        return e.nombre
    if e:
        u = db.query(Usuario).filter(Usuario.usuario_id == e.usuario_id).first()
        if u:
            return u.nombre
    return f"Empleado #{empleado_id}"


# ==========================================================================
# Facturación propia (Admin)
# ==========================================================================

@router.get("/facturacion", response_model=FacturacionResponse)
def mi_facturacion(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    empresa = db.query(Empresa).filter(Empresa.empresa_id == usuario_actual.empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    pagos = db.query(Pago).filter(
        Pago.empresa_id == empresa.empresa_id, Pago.is_deleted.is_(False),
    ).order_by(Pago.fecha_pago.desc()).all()
    total = sum(float(p.monto) for p in pagos if p.estado == "Aprobado")
    return FacturacionResponse(
        razon_social=empresa.razon_social, ruc=empresa.ruc,
        plan=empresa.plan_suscripcion, estado=empresa.estado, total_pagado=round(total, 2),
        pagos=[PagoItem(
            pago_id=p.pago_id, plan=p.plan, num_empleados=p.num_empleados, monto=float(p.monto),
            metodo_pago=p.metodo_pago, referencia=p.referencia, estado=p.estado, fecha_pago=p.fecha_pago,
        ) for p in pagos],
    )


@router.post("/facturacion/pagar", response_model=PagoItem)
def pagar_suscripcion(
    datos: PagarRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    """Renovación/pago de la suscripción propia (simulación de pasarela)."""
    if datos.metodo_pago not in {"Tarjeta", "Yape", "Transferencia"}:
        raise HTTPException(status_code=400, detail="Método de pago inválido.")
    if datos.num_empleados < 1:
        raise HTTPException(status_code=400, detail="Número de empleados inválido.")
    if datos.metodo_pago == "Tarjeta" and datos.tarjeta_ultimos4 == "0002":
        raise HTTPException(status_code=402, detail="Tu banco rechazó la transacción.")

    empresa = db.query(Empresa).filter(Empresa.empresa_id == usuario_actual.empresa_id).first()
    precio = PRECIOS_PLAN.get(empresa.plan_suscripcion, 10)
    monto = round(precio * datos.num_empleados, 2)
    pago = Pago(
        empresa_id=empresa.empresa_id, plan=empresa.plan_suscripcion,
        num_empleados=datos.num_empleados, monto=monto, metodo_pago=datos.metodo_pago,
        tarjeta_ultimos4=datos.tarjeta_ultimos4 if datos.metodo_pago == "Tarjeta" else None,
        referencia=f"OMN-{uuid.uuid4().hex[:10].upper()}", estado="Aprobado",
    )
    db.add(pago)
    # Un pago exitoso reactiva una empresa suspendida por morosidad.
    if empresa.estado == "Suspendida":
        empresa.estado = "Activa"
    db.commit()
    db.refresh(pago)
    registrar_auditoria(db, usuario_actual.usuario_id, "PAGO_SUSCRIPCION", "Facturación",
                        {"monto": monto, "referencia": pago.referencia})
    return PagoItem(
        pago_id=pago.pago_id, plan=pago.plan, num_empleados=pago.num_empleados, monto=float(pago.monto),
        metodo_pago=pago.metodo_pago, referencia=pago.referencia, estado=pago.estado, fecha_pago=pago.fecha_pago,
    )


@router.get("/facturacion/factura/{pago_id}")
def descargar_factura(
    pago_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    pago = db.query(Pago).filter(
        Pago.pago_id == pago_id, Pago.empresa_id == usuario_actual.empresa_id, Pago.is_deleted.is_(False),
    ).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    empresa = db.query(Empresa).filter(Empresa.empresa_id == usuario_actual.empresa_id).first()
    fecha = pago.fecha_pago.strftime("%Y-%m-%d") if pago.fecha_pago else ""
    html = f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Factura {pago.referencia}</title></head>
<body style="font-family:Arial,sans-serif;max-width:640px;margin:40px auto;color:#1f2430">
<h1 style="color:#EA580C;margin:0">Omnia HR</h1>
<p style="color:#6b7280;margin:4px 0 24px">Comprobante de suscripción SaaS</p>
<hr>
<p><strong>Cliente:</strong> {empresa.razon_social} (RUC {empresa.ruc})</p>
<p><strong>Referencia:</strong> {pago.referencia}</p>
<p><strong>Fecha:</strong> {fecha}</p>
<p><strong>Plan:</strong> {pago.plan} — {pago.num_empleados} usuario(s)</p>
<p><strong>Método:</strong> {pago.metodo_pago}</p>
<h2 style="text-align:right;color:#111">Total: S/ {float(pago.monto):.2f}</h2>
<p style="text-align:right"><span style="background:#DCFCE7;color:#166534;padding:4px 12px;border-radius:999px">{pago.estado}</span></p>
</body></html>"""
    return {"filename": f"factura_{pago.referencia}.html", "contenido": html, "mimetype": "text/html"}


# ==========================================================================
# Roles personalizados por sección (Admin)
# ==========================================================================

def _secciones_por_rol_backend(rol: str) -> List[str]:
    base = {
        "SuperAdmin": ["admin", "personal", "asistencia", "nomina", "auditoria"],
        "Admin": ["dashboard", "personal", "organigrama", "asistencia", "nomina", "beneficios", "aprobaciones", "cumplimiento", "configuracion", "auditoria"],
        "RRHH": ["dashboard", "personal", "organigrama", "asistencia", "nomina", "beneficios", "aprobaciones", "cumplimiento", "auditoria"],
        "Gerente": ["dashboard", "personal", "organigrama", "asistencia", "nomina", "aprobaciones"],
        "Empleado": ["mi-espacio"],
    }
    return base.get(rol, ["mi-espacio"])


@router.get("/permisos", response_model=List[PermisosUsuarioResponse])
def listar_permisos(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    usuarios = db.query(Usuario).filter(
        Usuario.empresa_id == usuario_actual.empresa_id,
        Usuario.is_deleted.is_(False),
        Usuario.rol != "SuperAdmin",   # el SuperAdmin no es gestionable por el Admin de la empresa
    ).all()
    salida = []
    for u in usuarios:
        override = db.query(PermisosUsuario).filter(PermisosUsuario.usuario_id == u.usuario_id).first()
        if override and override.secciones:
            secciones = [s for s in override.secciones.split(",") if s]
            personalizado = True
        else:
            secciones = _secciones_por_rol_backend(u.rol)
            personalizado = False
        salida.append(PermisosUsuarioResponse(
            usuario_id=u.usuario_id, nombre=u.nombre, correo=u.correo, rol=u.rol,
            secciones=secciones, personalizado=personalizado,
        ))
    return salida


@router.put("/permisos/{usuario_id}", response_model=PermisosUsuarioResponse)
def set_permisos(
    usuario_id: int,
    datos: SetPermisosRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    u = db.query(Usuario).filter(
        Usuario.usuario_id == usuario_id, Usuario.empresa_id == usuario_actual.empresa_id,
        Usuario.is_deleted.is_(False),
    ).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if u.rol == "SuperAdmin":
        raise HTTPException(status_code=403, detail="No puedes modificar los accesos del SuperAdmin.")

    override = db.query(PermisosUsuario).filter(PermisosUsuario.usuario_id == usuario_id).first()

    # Sin secciones => quitar el override (vuelve a las secciones de su rol).
    if not datos.secciones:
        if override:
            db.delete(override)
            db.commit()
        return PermisosUsuarioResponse(
            usuario_id=u.usuario_id, nombre=u.nombre, correo=u.correo, rol=u.rol,
            secciones=_secciones_por_rol_backend(u.rol), personalizado=False,
        )

    invalidas = [s for s in datos.secciones if s not in VALID_SECCIONES]
    if invalidas:
        raise HTTPException(status_code=400, detail=f"Secciones inválidas: {', '.join(invalidas)}")

    csv = ",".join(datos.secciones)
    if override:
        override.secciones = csv
        override.actualizado_por = usuario_actual.usuario_id
        override.fecha_actualizacion = datetime.utcnow()
    else:
        override = PermisosUsuario(
            usuario_id=usuario_id, empresa_id=usuario_actual.empresa_id, secciones=csv,
            actualizado_por=usuario_actual.usuario_id,
        )
        db.add(override)
    db.commit()
    registrar_auditoria(db, usuario_actual.usuario_id, "SET_PERMISOS_USUARIO", "Configuración",
                        {"usuario_id": usuario_id, "secciones": datos.secciones})
    return PermisosUsuarioResponse(
        usuario_id=u.usuario_id, nombre=u.nombre, correo=u.correo, rol=u.rol,
        secciones=datos.secciones, personalizado=True,
    )


# ==========================================================================
# Datos maestros del empleado
# ==========================================================================

@router.get("/mis-datos", response_model=MisDatosResponse)
def mis_datos(
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    return MisDatosResponse(
        empleado_id=empleado.empleado_id, tipo_documento=empleado.tipo_documento,
        numero_documento=empleado.numero_documento, direccion=empleado.direccion,
        banco=empleado.banco, cuenta_bancaria=empleado.cuenta_bancaria,
        cci=empleado.cci, cuspp=empleado.cuspp,
    )


@router.get("/derechohabientes/mios", response_model=List[DerechohabienteItem])
def mis_derechohabientes(
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    return db.query(Derechohabiente).filter(
        Derechohabiente.empleado_id == empleado.empleado_id,
        Derechohabiente.is_deleted.is_(False),
    ).order_by(Derechohabiente.fecha_creacion.desc()).all()


@router.post("/solicitudes-datos", response_model=SolicitudCambioResponse, status_code=status.HTTP_201_CREATED)
def crear_solicitud_datos(
    datos: SolicitudCambioCreate,
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    if datos.tipo_cambio not in TIPOS_CAMBIO:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Opciones: {', '.join(TIPOS_CAMBIO)}")

    sol = SolicitudCambioDatos(
        empresa_id=empleado.empresa_id, empleado_id=empleado.empleado_id,
        tipo_cambio=datos.tipo_cambio, payload=json.dumps(datos.payload, default=str),
        estado="Pendiente",
    )
    db.add(sol)
    db.commit()
    db.refresh(sol)

    nombre = _nombre_empleado(db, empleado.empleado_id)
    for admin in db.query(Usuario).filter(
        Usuario.empresa_id == empleado.empresa_id, Usuario.rol.in_(["RRHH", "Admin"]),
        Usuario.is_deleted.is_(False),
    ).all():
        crear_notificacion(db, empleado.empresa_id, "Solicitud de cambio de datos",
                           f"{nombre} solicita actualizar sus datos ({datos.tipo_cambio}).", admin.usuario_id)

    return _sol_response(db, sol)


@router.get("/solicitudes-datos/mias", response_model=List[SolicitudCambioResponse])
def mis_solicitudes_datos(
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    filas = db.query(SolicitudCambioDatos).filter(
        SolicitudCambioDatos.empleado_id == empleado.empleado_id,
        SolicitudCambioDatos.is_deleted.is_(False),
    ).order_by(SolicitudCambioDatos.fecha_creacion.desc()).all()
    return [_sol_response(db, s) for s in filas]


@router.get("/solicitudes-datos", response_model=List[SolicitudCambioResponse])
def listar_solicitudes_datos(
    solo_pendientes: bool = True,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    q = db.query(SolicitudCambioDatos).filter(
        SolicitudCambioDatos.empresa_id == usuario_actual.empresa_id,
        SolicitudCambioDatos.is_deleted.is_(False),
    )
    if solo_pendientes:
        q = q.filter(SolicitudCambioDatos.estado == "Pendiente")
    return [_sol_response(db, s) for s in q.order_by(SolicitudCambioDatos.fecha_creacion.desc()).all()]


@router.patch("/solicitudes-datos/{solicitud_id}/resolver", response_model=SolicitudCambioResponse)
def resolver_solicitud_datos(
    solicitud_id: int,
    datos: ResolverCambioRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["RRHH", "Admin"])),
):
    sol = db.query(SolicitudCambioDatos).filter(
        SolicitudCambioDatos.solicitud_id == solicitud_id,
        SolicitudCambioDatos.empresa_id == usuario_actual.empresa_id,
        SolicitudCambioDatos.is_deleted.is_(False),
    ).first()
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if sol.estado != "Pendiente":
        raise HTTPException(status_code=400, detail="La solicitud ya fue resuelta.")

    if datos.aprobar:
        _aplicar_cambio(db, sol)
        sol.estado = "Aprobada"
    else:
        sol.estado = "Rechazada"
    sol.resuelto_por = usuario_actual.usuario_id
    sol.comentario = datos.comentario
    sol.fecha_resolucion = datetime.utcnow()
    db.commit()
    db.refresh(sol)

    emp = db.query(Empleado).filter(Empleado.empleado_id == sol.empleado_id).first()
    if emp and emp.usuario_id:
        estado_txt = "aprobada" if datos.aprobar else "rechazada"
        crear_notificacion(db, sol.empresa_id, f"Tu solicitud de datos fue {estado_txt}",
                           f"La actualización de tus datos ({sol.tipo_cambio}) fue {estado_txt}.", emp.usuario_id)
    registrar_auditoria(db, usuario_actual.usuario_id, "RESOLVER_CAMBIO_DATOS", "Datos maestros",
                        {"solicitud_id": solicitud_id, "aprobada": datos.aprobar})
    return _sol_response(db, sol)


def _aplicar_cambio(db: Session, sol: SolicitudCambioDatos) -> None:
    """Aplica el cambio aprobado a la ficha del empleado / derechohabientes."""
    try:
        payload = json.loads(sol.payload)
    except Exception:
        payload = {}
    emp = db.query(Empleado).filter(Empleado.empleado_id == sol.empleado_id).first()
    if not emp:
        return

    if sol.tipo_cambio == "Bancario":
        if payload.get("banco") is not None:
            emp.banco = payload["banco"]
        if payload.get("cuenta_bancaria") is not None:
            emp.cuenta_bancaria = payload["cuenta_bancaria"]
        if payload.get("cci") is not None:
            emp.cci = payload["cci"]
    elif sol.tipo_cambio == "Domicilio":
        if payload.get("direccion") is not None:
            emp.direccion = payload["direccion"]
    elif sol.tipo_cambio == "Derechohabiente":
        accion = payload.get("accion", "alta")
        if accion == "baja" and payload.get("derechohabiente_id"):
            d = db.query(Derechohabiente).filter(
                Derechohabiente.derechohabiente_id == payload["derechohabiente_id"],
                Derechohabiente.empleado_id == emp.empleado_id,
            ).first()
            if d:
                d.estado = "Inactivo"
                d.is_deleted = True
        else:
            fnac = payload.get("fecha_nacimiento")
            db.add(Derechohabiente(
                empresa_id=emp.empresa_id, empleado_id=emp.empleado_id,
                nombre=payload.get("nombre", ""), parentesco=payload.get("parentesco", "Hijo"),
                tipo_documento=payload.get("tipo_documento", "DNI"),
                numero_documento=payload.get("numero_documento"),
                fecha_nacimiento=date.fromisoformat(fnac) if fnac else None,
            ))


def _sol_response(db: Session, sol: SolicitudCambioDatos) -> SolicitudCambioResponse:
    try:
        payload = json.loads(sol.payload)
    except Exception:
        payload = {}
    return SolicitudCambioResponse(
        solicitud_id=sol.solicitud_id, empleado_id=sol.empleado_id,
        empleado_nombre=_nombre_empleado(db, sol.empleado_id), tipo_cambio=sol.tipo_cambio,
        payload=payload, estado=sol.estado, comentario=sol.comentario, fecha_creacion=sol.fecha_creacion,
    )
