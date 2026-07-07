from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.scheduler import start_scheduler, stop_scheduler

from src.core.router import router as core_router
from src.hr.router import router as hr_router
from src.attendance.router import router as attendance_router
from src.attendance.turno_router import router as turno_router   # ← NUEVO
from src.attendance.kiosk_router import router as kiosk_router    # ← Fase 3
from src.payroll.router import router as payroll_router
from src.admin.router import router as admin_router
from src.ai.router import router as ai_router                  # ← Fase 4
from src.hr.vacaciones_router import router as vacaciones_router  # ← Fase 5
from src.payroll.beneficios_router import router as beneficios_router  # ← Fase 5
from src.hr.liquidacion_router import router as liquidacion_router  # ← Fase 5
from src.payroll.conceptos_router import router as conceptos_router  # ← Fase 5
from src.hr.permiso_router import router as permiso_router  # ← Fase 5

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(
    title="SaaS HR API",
    description="Sistema de Recursos Humanos — Módulos: Auth, Empleados, Asistencia, Nómina",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(core_router,       prefix="/api/core",       tags=["Autenticación"])
app.include_router(hr_router,         prefix="/api/empleados",  tags=["Empleados"])
app.include_router(attendance_router, prefix="/api/asistencia", tags=["Asistencia e Inasistencias"])
app.include_router(turno_router,      prefix="/api/turnos",     tags=["Turnos"])        # ← NUEVO
app.include_router(kiosk_router,      prefix="/api/kiosco",     tags=["Kiosco Facial"])  # ← Fase 3
app.include_router(payroll_router,    prefix="/api/nominas",    tags=["Nómina y Boletas"])
app.include_router(admin_router,      prefix="/api/admin",      tags=["Admin"])
app.include_router(ai_router,         prefix="/api/ia",         tags=["Copiloto IA"])   # ← Fase 4
app.include_router(vacaciones_router, prefix="/api/vacaciones", tags=["Vacaciones"])    # ← Fase 5
app.include_router(beneficios_router, prefix="/api/beneficios", tags=["Beneficios Sociales"])  # ← Fase 5
app.include_router(liquidacion_router, prefix="/api/liquidaciones", tags=["Liquidaciones"])   # ← Fase 5
app.include_router(conceptos_router,   prefix="/api/conceptos",     tags=["Conceptos Variables"])  # ← Fase 5
app.include_router(permiso_router,     prefix="/api/permisos",      tags=["Permisos y Descansos Médicos"])  # ← Fase 5


@app.get("/")
def root():
    return {"status": "OK", "version": "2.0.0"}