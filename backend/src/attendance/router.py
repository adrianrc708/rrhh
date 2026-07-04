from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from openai import OpenAI
import google.generativeai as genai

class AIChatMessage(BaseModel):
    role: str
    content: str

class AIInsightsRequest(BaseModel):
    messages: List[AIChatMessage] = []
    empleado_id: Optional[int] = None

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import verificar_rol
from src.core.services import registrar_auditoria          # ← NUEVO
from src.attendance.models import Inasistencia, TIPOS_QUE_DESCUENTAN
from src.attendance.schemas import InasistenciaCreate, InasistenciaResponse
from src.hr.models import Empleado
from src.attendance.zkteco_sync import sincronizar_zkteco
from src.core.dependencies import obtener_usuario_actual

router = APIRouter()


def _enriquecer(inasistencia: Inasistencia) -> dict:
    data = {c.name: getattr(inasistencia, c.name) for c in inasistencia.__table__.columns}
    data["descuenta_sueldo"] = inasistencia.tipo in TIPOS_QUE_DESCUENTAN
    return data


@router.post("/", response_model=InasistenciaResponse, status_code=status.HTTP_201_CREATED)
def registrar_inasistencia(
    datos: InasistenciaCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == datos.empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado en esta empresa")

    periodo = datos.fecha.strftime("%Y-%m")
    inasistencia = Inasistencia(
        **datos.model_dump(),
        empresa_id=usuario_actual.empresa_id,
        periodo=periodo,
        registrado_por=usuario_actual.usuario_id,
    )
    db.add(inasistencia)
    db.commit()
    db.refresh(inasistencia)

    # RF-16: registrar en auditoría
    registrar_auditoria(
        db,
        usuario_actual.usuario_id,
        "REGISTRAR_INASISTENCIA",
        "Asistencia",
        {
            "empleado_id": datos.empleado_id,
            "fecha": str(datos.fecha),
            "tipo": datos.tipo,
            "horas_ausentes": float(datos.horas_ausentes),
        },
    )

    return _enriquecer(inasistencia)


@router.get("/empleado/{empleado_id}", response_model=List[InasistenciaResponse])
def listar_inasistencias(
    empleado_id: int,
    periodo: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente", "Empleado"])),  # ← Empleado puede ver las suyas
):
    query = db.query(Inasistencia).filter(
        Inasistencia.empleado_id == empleado_id,
        Inasistencia.empresa_id == usuario_actual.empresa_id,
    )
    if periodo:
        query = query.filter(Inasistencia.periodo == periodo)

    return [_enriquecer(i) for i in query.order_by(Inasistencia.fecha).all()]


@router.delete("/{inasistencia_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_inasistencia(
    inasistencia_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    inasistencia = db.query(Inasistencia).filter(
        Inasistencia.inasistencia_id == inasistencia_id,
        Inasistencia.empresa_id == usuario_actual.empresa_id,
    ).first()
    if not inasistencia:
        raise HTTPException(status_code=404, detail="Inasistencia no encontrada")

    # RF-16: registrar en auditoría antes de borrar
    registrar_auditoria(
        db,
        usuario_actual.usuario_id,
        "ELIMINAR_INASISTENCIA",
        "Asistencia",
        {"inasistencia_id": inasistencia_id},
    )

    db.delete(inasistencia)
    db.commit()

@router.post("/sync-zkteco")
def sync_zkteco(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    """
    RF-07: Conecta con el biométrico ZKTeco y extrae las marcaciones del día.
    Requiere que ZKTECO_IP esté configurada en el .env
    """
    try:
        resultado = sincronizar_zkteco(db, usuario_actual.empresa_id)
        registrar_auditoria(
            db,
            usuario_actual.usuario_id,
            "SYNC_ZKTECO",
            "Asistencia",
            resultado,
        )
        return resultado
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ai-insights")
def ai_insights(
    request: AIInsightsRequest,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    """
    RF-10: Genera insights de IA sobre inasistencias con soporte conversacional.
    """
    query = db.query(Inasistencia).filter(
        Inasistencia.empresa_id == usuario_actual.empresa_id
    )
    
    if request.empleado_id:
        query = query.filter(Inasistencia.empleado_id == request.empleado_id)
        
    inasistencias = query.all()
    
    if not inasistencias:
        return {"analysis": "No hay datos suficientes de inasistencias para generar un análisis."}
        
    empleados = db.query(Empleado).filter(Empleado.empresa_id == usuario_actual.empresa_id).all()
    empleados_dict = {e.empleado_id: e.nombre for e in empleados}
    
    datos_contexto = []
    for i in inasistencias:
        nombre = empleados_dict.get(i.empleado_id, f"ID {i.empleado_id}")
        datos_contexto.append(f"Empleado: {nombre}, Fecha: {i.fecha}, Tipo: {i.tipo}, Horas: {i.horas_ausentes}")
    
    contexto = "\n".join(datos_contexto)
    
    system_prompt = f"""
    Actúa como un analista de recursos humanos experto. Tienes acceso al siguiente registro de inasistencias:
    {contexto}
    
    Si el usuario no hace una pregunta específica, proporciona un análisis estructurado:
    1. Identificación de patrones o tendencias de ausentismo.
    2. El impacto general basado en el tipo de inasistencias.
    3. Recomendaciones accionables para mejorar la asistencia.
    
    Responde en Markdown. Sé conciso, profesional y mantén un tono constante.
    """
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
    
    if not gemini_key and not openai_key:
        return {"analysis": "La API key de IA no está configurada en el backend."}
        
    try:
        if gemini_key:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel(
                model_name='gemini-2.5-flash',
                system_instruction=system_prompt,
                generation_config={"temperature": 0.2}
            )
            
            history = []
            for m in request.messages:
                history.append({"role": "model" if m.role == "assistant" else "user", "parts": [m.content]})
                
            if not history:
                response = model.generate_content("Genera el análisis general de inasistencias.")
            else:
                chat = model.start_chat(history=history[:-1])
                response = chat.send_message(history[-1]["parts"][0])
                
            analysis = response.text
        else:
            base_url = "https://api.groq.com/openai/v1" if os.getenv("GROQ_API_KEY") else None
            model = "llama3-8b-8192" if os.getenv("GROQ_API_KEY") else "gpt-3.5-turbo"
            client = OpenAI(api_key=openai_key, base_url=base_url)
            
            openai_msgs = [{"role": "system", "content": system_prompt}]
            for m in request.messages:
                openai_msgs.append({"role": m.role, "content": m.content})
                
            if not request.messages:
                openai_msgs.append({"role": "user", "content": "Genera el análisis general de inasistencias."})
                
            response = client.chat.completions.create(
                model=model,
                messages=openai_msgs,
                temperature=0.2
            )
            analysis = response.choices[0].message.content
        
        registrar_auditoria(
            db,
            usuario_actual.usuario_id,
            "GENERAR_AI_INSIGHTS",
            "Asistencia",
            {"registros_analizados": len(inasistencias)},
        )
        
        return {"analysis": analysis}
    except Exception as e:
        print(f"Error AI: {e}")
        return {"analysis": f"Ocurrió un error al generar el análisis: {str(e)}"}