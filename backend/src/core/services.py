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