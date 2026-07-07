from sqlalchemy.orm import Session
from src.core.models import EventoAuditoria, DetalleNomina, Notificacion, Usuario
from src.hr.models import Empleado, Contrato
import json
from datetime import date, timedelta

def calcular_sueldo_neto(sueldo_base: float, haberes: float, descuentos: float) -> float:
    return (sueldo_base + haberes) - descuentos

def procesar_detalle_nomina(db: Session, nomina_id: int, empleado_id: int, base: float, hab: float, desc: float):
    neto = calcular_sueldo_neto(base, hab, desc)
    nuevo_detalle = DetalleNomina(
        nomina_id=nomina_id,
        usuario_id=empleado_id,
        sueldo_base=base,
        haberes=hab,
        descuentos=desc,
        sueldo_neto=neto
    )
    db.add(nuevo_detalle)
    return nuevo_detalle

def registrar_auditoria(db: Session, usuario_id: int, accion: str, modulo: str, detalles: dict = None):
    # default=str permite serializar Decimal, date y datetime sin romper
    detalles_str = json.dumps(detalles, default=str) if detalles else None
    nuevo_evento = EventoAuditoria(
        usuario_id=usuario_id,
        accion=accion,
        modulo=modulo,
        detalles=detalles_str
    )
    db.add(nuevo_evento)
    db.commit()

def crear_notificacion(db: Session, empresa_id: int, titulo: str, mensaje: str, usuario_id: int = None):
    notif = Notificacion(
        empresa_id=empresa_id,
        usuario_id=usuario_id,
        titulo=titulo,
        mensaje=mensaje
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

UMBRALES_ALERTA = [30, 15, 5]  # días antes del evento (Fase 4)


def _notificar_admins(db: Session, empresa_id: int, titulo: str, mensaje: str) -> int:
    admins = db.query(Usuario).filter(
        Usuario.empresa_id == empresa_id,
        Usuario.rol.in_(["Admin", "RRHH", "Administrador"]),
        Usuario.estado == "Activo",
        Usuario.is_deleted.is_(False),
    ).all()
    for admin in admins:
        crear_notificacion(db, empresa_id, titulo, mensaje, admin.usuario_id)
    return len(admins)


def generar_alertas_proactivas(db: Session) -> int:
    """
    Fase 4 — Motor de alertas proactivas. Evalúa a diario y notifica a 30/15/5 días:
      - Vencimiento de contrato (Contrato.fecha_fin).
      - Fin del periodo de prueba (Contrato.fecha_inicio + 3 meses).
    El match por día exacto evita duplicados entre ejecuciones diarias.
    (Los descansos médicos prolongados se engancharán en la Fase 5, cuando exista
    la fecha de fin de licencia.)
    """
    hoy = date.today()
    creadas = 0

    contratos = db.query(Contrato).join(
        Empleado, Contrato.empleado_id == Empleado.empleado_id
    ).filter(
        Contrato.estado == "Vigente",
        Contrato.is_deleted.is_(False),
        Empleado.estado == "Activo",
        Empleado.is_deleted.is_(False),
    ).all()

    for contrato in contratos:
        emp = db.query(Empleado).filter(Empleado.empleado_id == contrato.empleado_id).first()
        if not emp:
            continue
        u = db.query(Usuario).filter(Usuario.usuario_id == emp.usuario_id).first()
        nombre = emp.nombre or (u.nombre if u else f"ID {emp.empleado_id}")

        # 1) Vencimiento de contrato
        if contrato.fecha_fin:
            dias = (contrato.fecha_fin - hoy).days
            if dias in UMBRALES_ALERTA:
                crear_notificacion(db, emp.empresa_id, "Tu contrato está por vencer",
                                   f"Tu contrato vence en {dias} días ({contrato.fecha_fin}). Acércate a RRHH.", emp.usuario_id)
                creadas += 1
                creadas += _notificar_admins(db, emp.empresa_id, "Alerta: contrato por vencer",
                                             f"El contrato de {nombre} vence en {dias} días ({contrato.fecha_fin}).")

        # 2) Fin del periodo de prueba (3 meses desde el inicio)
        if contrato.fecha_inicio:
            fin_prueba = contrato.fecha_inicio + timedelta(days=90)
            dias_p = (fin_prueba - hoy).days
            if dias_p in UMBRALES_ALERTA:
                creadas += _notificar_admins(db, emp.empresa_id, "Fin de periodo de prueba",
                                             f"El periodo de prueba de {nombre} termina en {dias_p} días ({fin_prueba}).")

    return creadas


def verificar_vencimiento_contratos(db: Session):
    # Buscar contratos vigentes cuya fecha de fin es exactamente en 7 días
    fecha_limite = date.today() + timedelta(days=7)

    contratos_por_vencer = db.query(Contrato).filter(
        Contrato.fecha_fin == fecha_limite,
        Contrato.estado == "Vigente"
    ).all()

    notificaciones_creadas = 0
    for contrato in contratos_por_vencer:
        emp = db.query(Empleado).filter(
            Empleado.empleado_id == contrato.empleado_id,
            Empleado.estado == "Activo"
        ).first()
        if not emp:
            continue
        # 1. Notificar al empleado
        mensaje_emp = f"Tu contrato vence en 7 días ({fecha_limite.strftime('%Y-%m-%d')}). Por favor, acércate a RRHH."
        crear_notificacion(db, emp.empresa_id, "Vencimiento de Contrato Próximo", mensaje_emp, emp.usuario_id)
        
        # 2. Notificar a los administradores de la empresa
        admins = db.query(Usuario).filter(
            Usuario.empresa_id == emp.empresa_id,
            Usuario.rol.in_(["Admin", "Administrador"]),
            Usuario.estado == "Activo"
        ).all()
        
        for admin in admins:
            # Obtener datos del empleado para el mensaje
            empleado_info = db.query(Usuario).filter(Usuario.usuario_id == emp.usuario_id).first()
            nombre_emp = empleado_info.nombre if empleado_info else f"ID {emp.empleado_id}"
            
            mensaje_admin = f"El contrato del empleado {nombre_emp} vence en 7 días ({fecha_limite.strftime('%Y-%m-%d')})."
            crear_notificacion(db, emp.empresa_id, "Alerta: Vencimiento de Contrato", mensaje_admin, admin.usuario_id)
            
        notificaciones_creadas += 1 + len(admins)
        
    return notificaciones_creadas