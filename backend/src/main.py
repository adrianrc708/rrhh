from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.scheduler import start_scheduler, stop_scheduler

from src.core.router import router as core_router
from src.hr.router import router as hr_router
from src.attendance.router import router as attendance_router
from src.attendance.turno_router import router as turno_router   # ← NUEVO
from src.payroll.router import router as payroll_router

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
app.include_router(payroll_router,    prefix="/api/nominas",    tags=["Nómina y Boletas"])


@app.get("/")
def root():
    return {"status": "OK", "version": "2.0.0"}