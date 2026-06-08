from fastapi import FastAPI
from src.core.router import router as core_router

app = FastAPI(title="SaaS HR API")

# Aquí es donde "enchufas" tus rutas para que aparezcan en la interfaz
app.include_router(core_router, prefix="/api/core", tags=["Seguridad y Núcleo"])

@app.get("/")
def read_root():
    return {"status": "OK", "mensaje": "Servidor funcionando correctamente"}