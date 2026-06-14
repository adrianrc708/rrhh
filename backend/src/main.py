from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # NUEVO IMPORT
from src.core.router import router as core_router

app = FastAPI(title="SaaS HR API")

# NUEVO: Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Aquí es donde "enchufas" tus rutas para que aparezcan en la interfaz
app.include_router(core_router, prefix="/api/core", tags=["Seguridad y Núcleo"])

@app.get("/")
def read_root():
    return {"status": "OK", "mensaje": "Servidor funcionando correctamente"}