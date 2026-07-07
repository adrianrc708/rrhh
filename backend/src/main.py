from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
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
from src.benefits.router import router as benefits_router      # ← Fase 5
from src.compliance.router import router as compliance_router  # ← Fase 6
from src.infrastructure.router import (                          # ← Fase 7
    router as infra_router, registrar_log_tecnico, detectar_sospecha,
)
from src.saas.router import router as saas_router                # ← Fase 7

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


# Fase 7 — Auditoría técnica global: registra errores del backend (5xx / excepciones)
# e intentos de inyección en el log técnico cross-tenant (lo consulta el SuperAdmin).
@app.middleware("http")
async def auditoria_tecnica(request: Request, call_next):
    ruta = str(request.url.path)
    if request.url.query:
        ruta += "?" + request.url.query
    ip = request.client.host if request.client else None

    if detectar_sospecha(ruta):
        registrar_log_tecnico("SECURITY", request.method, ruta, None,
                              "Patrón sospechoso detectado en la petición.", ip)
    try:
        response = await call_next(request)
    except Exception as exc:  # noqa: BLE001 — se re-lanza tras registrar
        registrar_log_tecnico("ERROR", request.method, ruta, 500,
                              f"{type(exc).__name__}: {exc}", ip)
        raise
    if response.status_code >= 500:
        registrar_log_tecnico("ERROR", request.method, ruta, response.status_code,
                              "Respuesta 5xx del backend.", ip)
    return response

app.include_router(core_router,       prefix="/api/core",       tags=["Autenticación"])
app.include_router(hr_router,         prefix="/api/empleados",  tags=["Empleados"])
app.include_router(attendance_router, prefix="/api/asistencia", tags=["Asistencia e Inasistencias"])
app.include_router(turno_router,      prefix="/api/turnos",     tags=["Turnos"])        # ← NUEVO
app.include_router(kiosk_router,      prefix="/api/kiosco",     tags=["Kiosco Facial"])  # ← Fase 3
app.include_router(payroll_router,    prefix="/api/nominas",    tags=["Nómina y Boletas"])
app.include_router(admin_router,      prefix="/api/admin",      tags=["Admin"])
app.include_router(ai_router,         prefix="/api/ia",         tags=["Copiloto IA"])   # ← Fase 4
app.include_router(benefits_router,   prefix="/api/beneficios", tags=["Beneficios y Autogestión"])  # ← Fase 5
app.include_router(compliance_router, prefix="/api/cumplimiento", tags=["Cumplimiento Legal"])       # ← Fase 6
app.include_router(infra_router,      prefix="/api/infra",      tags=["Auditoría Técnica"])         # ← Fase 7
app.include_router(saas_router,       prefix="/api/saas",       tags=["Administración SaaS"])       # ← Fase 7


@app.get("/")
def root():
    return {"status": "OK", "version": "2.0.0"}