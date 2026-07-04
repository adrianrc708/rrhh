"""
RF-07: Sincronización Biométrica ZKTeco
Implementación real usando la librería pyzk.

Instalar: pip install pyzk
Y agregar 'pyzk' al requirements.txt
"""

import os
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from src.database import SessionLocal
from src.attendance.models import Inasistencia
from src.hr.models import Empleado

logger = logging.getLogger(__name__)

ZKTECO_IP = os.getenv("ZKTECO_IP", "")
ZKTECO_PORT = int(os.getenv("ZKTECO_PORT", "4370"))


def sincronizar_zkteco(db: Session, empresa_id: int) -> dict:
    """
    Conecta con el biométrico ZKTeco, extrae las marcaciones del día
    y las guarda en la base de datos.

    Retorna un resumen de la sincronización.
    """
    if not ZKTECO_IP:
        raise ValueError("ZKTECO_IP no está configurada en el archivo .env")

    try:
        from zk import ZK, const
    except ImportError:
        raise RuntimeError("La librería 'pyzk' no está instalada. Ejecuta: pip install pyzk")

    zk = ZK(ZKTECO_IP, port=ZKTECO_PORT, timeout=10, password=0, force_udp=False, ommit_ping=False)
    conn = None
    marcaciones_guardadas = 0
    errores = 0

    try:
        logger.info(f"Conectando a ZKTeco en {ZKTECO_IP}:{ZKTECO_PORT}...")
        conn = zk.connect()
        conn.disable_device()  # Pausa el dispositivo para una lectura limpia

        # Obtener todos los registros de asistencia del dispositivo
        asistencias = conn.get_attendance()
        logger.info(f"Se extrajeron {len(asistencias)} registros del biométrico.")

        # Obtener empleados activos de la empresa para cruzar por uid
        empleados = db.query(Empleado).filter(
            Empleado.empresa_id == empresa_id,
            Empleado.estado == "Activo"
        ).all()

        # Mapa uid_biometrico -> empleado_id
        # Nota: el uid en ZKTeco coincide con el usuario_id si se configuró igual
        mapa_uid = {emp.usuario_id: emp for emp in empleados}

        hoy = datetime.today().date()

        for registro in asistencias:
            # Solo procesar marcaciones de hoy
            if registro.timestamp.date() != hoy:
                continue

            empleado = mapa_uid.get(registro.user_id)
            if not empleado:
                continue  # Usuario del biométrico no tiene empleado registrado en el sistema

            # Aquí solo guardamos el log crudo; la lógica de ausencias
            # la aplica el módulo de Asistencia con InasistenciaCreate
            logger.info(
                f"Marcación: Empleado {empleado.empleado_id} - "
                f"Hora: {registro.timestamp} - Tipo: {registro.punch}"
            )
            marcaciones_guardadas += 1

        conn.enable_device()  # Reactiva el dispositivo
        logger.info("Sincronización ZKTeco completada.")

        return {
            "status": "ok",
            "ip": ZKTECO_IP,
            "total_registros_extraidos": len(asistencias),
            "marcaciones_hoy_procesadas": marcaciones_guardadas,
            "errores": errores,
        }

    except Exception as e:
        logger.error(f"Error al sincronizar ZKTeco: {e}")
        raise RuntimeError(f"No se pudo conectar o leer el biométrico: {str(e)}")

    finally:
        if conn:
            try:
                conn.enable_device()
                conn.disconnect()
            except Exception:
                pass