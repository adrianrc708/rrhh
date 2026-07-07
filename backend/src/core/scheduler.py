import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from src.database import SessionLocal
from src.core.models import Nomina, HistorialAprobacion
from src.core.services import generar_alertas_proactivas

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def cierre_mensual_planilla():
    """
    Cronjob 1: Pasa las nóminas en estado 'Aprobado' a 'Pagado'.
    Se ejecutará al final del mes.
    """
    logger.info("Iniciando cierre mensual de planilla...")
    db: Session = SessionLocal()
    try:
        nominas_aprobadas = db.query(Nomina).filter(Nomina.estado == "Aprobado").all()
        
        for nomina in nominas_aprobadas:
            nomina.estado = "Pagado"
            
            # Registrar en el historial de aprobación
            historial = HistorialAprobacion(
                nomina_id=nomina.id,
                usuario_id=None, # Sistema
                estado_anterior="Aprobado",
                estado_nuevo="Pagado",
                comentarios="Cierre mensual automatizado por el sistema"
            )
            db.add(historial)
            
        db.commit()
        logger.info(f"Cierre de planilla completado. {len(nominas_aprobadas)} nóminas pagadas.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error en el cierre mensual de planilla: {e}")
    finally:
        db.close()

def extraccion_nocturna_datos():
    """
    Cronjob 2: Simulación de extracción nocturna de datos.
    Genera reporte básico de inasistencias.
    """
    logger.info("Iniciando extracción nocturna de datos...")
    # Aquí iría la lógica de consulta a BD y exportación (ej: CSV, envío a S3 o BI)
    logger.info("Extracción de datos simulada con éxito.")

def cronjob_alertas_proactivas():
    """
    Cronjob (Fase 4): motor de alertas proactivas 30/15/5 días (contratos y
    fin de periodo de prueba). Inyecta notificaciones en los dashboards.
    """
    logger.info("Ejecutando motor de alertas proactivas...")
    db: Session = SessionLocal()
    try:
        creadas = generar_alertas_proactivas(db)
        logger.info(f"Alertas proactivas: {creadas} notificaciones creadas.")
    except Exception as e:
        logger.error(f"Error en alertas proactivas: {e}")
    finally:
        db.close()

# Configuración del scheduler
scheduler = BackgroundScheduler()

def start_scheduler():
    """
    Inicializa el scheduler con las tareas programadas.
    """
    # Ejecutar el cierre mensual de planilla el último día del mes a las 23:50
    scheduler.add_job(
        cierre_mensual_planilla,
        trigger=CronTrigger(day="last", hour=23, minute=50),
        id="cierre_mensual",
        replace_existing=True
    )
    
    # Ejecutar la extracción nocturna todos los días a las 02:00 AM
    scheduler.add_job(
        extraccion_nocturna_datos,
        trigger=CronTrigger(hour=2, minute=0),
        id="extraccion_nocturna",
        replace_existing=True
    )
    
    # Ejecutar el motor de alertas proactivas todos los días a las 08:00 AM
    scheduler.add_job(
        cronjob_alertas_proactivas,
        trigger=CronTrigger(hour=8, minute=0),
        id="alertas_proactivas",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("APScheduler iniciado correctamente con las tareas programadas.")

def stop_scheduler():
    scheduler.shutdown()
    logger.info("APScheduler detenido.")
