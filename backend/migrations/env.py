import sys
import os
# Asegura que Alembic pueda encontrar el módulo 'src' en el PATH de Python
sys.path.insert(0, os.getcwd())

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# 1. Importamos el Base central de la aplicación
from src.database import Base

# 2. Importamos todos tus modelos relacionales para que Alembic los detecte automáticamente
from src.core.models import Empresa, Usuario, Nomina, Notificacion, EventoAuditoria, HistorialAprobacion
from src.hr.models import Empleado, Departamento, Cargo, Contrato
from src.hr.vacaciones_models import SolicitudVacaciones
from src.hr.liquidacion_models import Liquidacion
from src.hr.permiso_models import SolicitudPermiso
from src.hr.desempeno_models import EvaluacionDesempeno, IncidenciaDisciplinaria
# Importamos los otros módulos por si tus compañeros añadieron algo
from src.attendance.models import *
from src.attendance.turno_models import Turno, AsignacionTurno
from src.payroll.models import *
from src.payroll.beneficios_models import BeneficioSocial
from src.payroll.conceptos_models import ConceptoVariable

# Objeto de configuración de Alembic
config = context.config

# Configurar el sistema de logs nativo
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 3. Le indicamos a Alembic dónde residen los metadatos de nuestras tablas
target_metadata = Base.metadata

# 4. Inyectamos dinámicamente la URL de la Base de Datos desde las variables de entorno de Docker
config.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL"))


def run_migrations_offline() -> None:
    """Ejecutar migraciones en modo offline (genera archivos SQL planos)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Ejecutar migraciones en modo online (conecta e impacta la BD real)."""
    # CORRECCIÓN AQUÍ: Cambiado config_main_name por config_ini_section
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()