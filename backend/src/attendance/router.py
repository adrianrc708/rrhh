from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import json
from openai import OpenAI
import google.generativeai as genai

class AIChatMessage(BaseModel):
    role: str
    content: str

class AIInsightsRequest(BaseModel):
    messages: List[AIChatMessage] = []
    empleado_id: Optional[int] = None

from src.database import get_db
from src.core.models import Usuario, HorasPeriodo
from src.core.dependencies import (
    verificar_rol, obtener_usuario_actual, obtener_empleado_actual, alcance_empleados,
)
from src.core.services import registrar_auditoria          # ← NUEVO
from src.attendance.models import (
    Inasistencia, TIPOS_QUE_DESCUENTAN,
    DispositivoKiosco, RostroEmpleado, Marcacion, CicloJornada, CierreAsistencia,
)
from src.attendance.schemas import (
    InasistenciaCreate, InasistenciaResponse,
    DispositivoCreate, DispositivoResponse, DispositivoCreado,
    RostroCreate, RostroAutoCreate, RostroResponse, MarcarRemoto, MarcacionResponse,
    CicloJornadaCreate, CicloJornadaResponse, ConciliacionItem, CierreResponse,
)
from src.hr.models import Empleado
from src.attendance.zkteco_sync import sincronizar_zkteco
from src.attendance import biometrics
from src.attendance.marcaje import registrar_marcacion
from src.attendance.segmentation import conciliar_periodo
from src.ai import llm

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
    
    # Fase 4: usa el proveedor LLM compartido (src/ai/llm.py).
    analysis = llm.responder(
        system_prompt,
        [{"role": m.role, "content": m.content} for m in request.messages],
        prompt_inicial="Genera el análisis general de inasistencias.",
    )
    registrar_auditoria(
        db,
        usuario_actual.usuario_id,
        "GENERAR_AI_INSIGHTS",
        "Asistencia",
        {"registros_analizados": len(inasistencias)},
    )
    return {"analysis": analysis}


# ============================================================================
# Fase 3 — Dispositivos kiosco (Admin/RRHH)
# ============================================================================

@router.post("/dispositivos", response_model=DispositivoCreado, status_code=status.HTTP_201_CREATED)
def crear_dispositivo(
    datos: DispositivoCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    """Registra una tablet kiosco. Devuelve el token UNA sola vez (no se puede recuperar)."""
    secreto = biometrics.generar_secreto_dispositivo()
    dispositivo = DispositivoKiosco(
        empresa_id=usuario_actual.empresa_id,
        nombre=datos.nombre,
        token_hash=biometrics.hash_secreto(secreto),
        pin_hash=biometrics.hash_secreto(datos.pin),
    )
    db.add(dispositivo)
    db.commit()
    db.refresh(dispositivo)

    registrar_auditoria(db, usuario_actual.usuario_id, "CREAR_DISPOSITIVO_KIOSCO", "Asistencia",
                        {"dispositivo_id": dispositivo.dispositivo_id, "nombre": dispositivo.nombre})

    token = biometrics.construir_token(dispositivo.dispositivo_id, secreto)
    return DispositivoCreado(
        dispositivo_id=dispositivo.dispositivo_id, nombre=dispositivo.nombre,
        activo=dispositivo.activo, ultimo_uso=dispositivo.ultimo_uso,
        fecha_creacion=dispositivo.fecha_creacion, token=token,
    )


@router.get("/dispositivos", response_model=List[DispositivoResponse])
def listar_dispositivos(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    return db.query(DispositivoKiosco).filter(
        DispositivoKiosco.empresa_id == usuario_actual.empresa_id,
        DispositivoKiosco.is_deleted.is_(False),
    ).order_by(DispositivoKiosco.dispositivo_id.desc()).all()


@router.delete("/dispositivos/{dispositivo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_dispositivo(
    dispositivo_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    dispositivo = db.query(DispositivoKiosco).filter(
        DispositivoKiosco.dispositivo_id == dispositivo_id,
        DispositivoKiosco.empresa_id == usuario_actual.empresa_id,
        DispositivoKiosco.is_deleted.is_(False),
    ).first()
    if not dispositivo:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    dispositivo.is_deleted = True
    dispositivo.activo = False
    db.commit()


# ============================================================================
# Fase 3 — Enrolamiento facial (Admin/RRHH)
# ============================================================================

@router.post("/rostros", response_model=RostroResponse, status_code=status.HTTP_201_CREATED)
def enrolar_rostro(
    datos: RostroCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == datos.empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado en tu empresa")

    try:
        descriptor = biometrics.validar_descriptor(datos.descriptor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rostro = RostroEmpleado(
        empresa_id=usuario_actual.empresa_id,
        empleado_id=datos.empleado_id,
        descriptor=json.dumps(descriptor),
        etiqueta=datos.etiqueta,
    )
    db.add(rostro)
    db.commit()
    db.refresh(rostro)
    registrar_auditoria(db, usuario_actual.usuario_id, "ENROLAR_ROSTRO", "Asistencia",
                        {"empleado_id": datos.empleado_id, "rostro_id": rostro.id})
    return rostro


@router.get("/rostros/empleado/{empleado_id}", response_model=List[RostroResponse])
def listar_rostros(
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    return db.query(RostroEmpleado).filter(
        RostroEmpleado.empleado_id == empleado_id,
        RostroEmpleado.empresa_id == usuario_actual.empresa_id,
        RostroEmpleado.is_deleted.is_(False),
    ).all()


@router.delete("/rostros/{rostro_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_rostro(
    rostro_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    rostro = db.query(RostroEmpleado).filter(
        RostroEmpleado.id == rostro_id,
        RostroEmpleado.empresa_id == usuario_actual.empresa_id,
        RostroEmpleado.is_deleted.is_(False),
    ).first()
    if not rostro:
        raise HTTPException(status_code=404, detail="Rostro no encontrado")
    rostro.is_deleted = True
    rostro.activo = False
    db.commit()


# ============================================================================
# Auto-enrolamiento facial (Empleado autenticado, sin permisos de Admin/RRHH)
# ============================================================================
MAX_MUESTRAS_AUTOENROLAMIENTO = 3


@router.post("/rostros/mi-rostro", response_model=RostroResponse, status_code=status.HTTP_201_CREATED)
def enrolar_mi_rostro(
    datos: RostroAutoCreate,
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    """El propio empleado registra su rostro desde Mi Espacio para poder usar el kiosco."""
    try:
        descriptor = biometrics.validar_descriptor(datos.descriptor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    activas = db.query(RostroEmpleado).filter(
        RostroEmpleado.empleado_id == empleado.empleado_id,
        RostroEmpleado.activo.is_(True),
        RostroEmpleado.is_deleted.is_(False),
    ).count()
    if activas >= MAX_MUESTRAS_AUTOENROLAMIENTO:
        raise HTTPException(
            status_code=400,
            detail=f"Ya tienes {MAX_MUESTRAS_AUTOENROLAMIENTO} muestras registradas. Elimina una para volver a enrolar.",
        )

    rostro = RostroEmpleado(
        empresa_id=empleado.empresa_id,
        empleado_id=empleado.empleado_id,
        descriptor=json.dumps(descriptor),
        etiqueta=datos.etiqueta or "autoenrolamiento",
    )
    db.add(rostro)
    db.commit()
    db.refresh(rostro)
    return rostro


@router.get("/rostros/mi-rostro", response_model=List[RostroResponse])
def listar_mi_rostro(
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    return db.query(RostroEmpleado).filter(
        RostroEmpleado.empleado_id == empleado.empleado_id,
        RostroEmpleado.is_deleted.is_(False),
    ).all()


@router.delete("/rostros/mi-rostro/{rostro_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_mi_rostro(
    rostro_id: int,
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    rostro = db.query(RostroEmpleado).filter(
        RostroEmpleado.id == rostro_id,
        RostroEmpleado.empleado_id == empleado.empleado_id,
        RostroEmpleado.is_deleted.is_(False),
    ).first()
    if not rostro:
        raise HTTPException(status_code=404, detail="Rostro no encontrado")
    rostro.is_deleted = True
    rostro.activo = False
    db.commit()


# ============================================================================
# Fase 3 — Marcación remota (Empleado autenticado) y consulta de marcaciones
# ============================================================================

@router.post("/marcar-remoto", response_model=MarcacionResponse)
def marcar_remoto(
    datos: MarcarRemoto,
    request: Request,
    db: Session = Depends(get_db),
    empleado: Empleado = Depends(obtener_empleado_actual),
):
    """Marcación para teletrabajo/campo: captura GPS e IP de origen."""
    ip = request.client.host if request.client else None
    marcacion = registrar_marcacion(
        db, empresa_id=empleado.empresa_id, empleado_id=empleado.empleado_id,
        origen="remoto", lat=datos.lat, lng=datos.lng, ip=ip,
    )
    return marcacion


@router.get("/marcaciones", response_model=List[MarcacionResponse])
def listar_marcaciones(
    empleado_id: Optional[int] = None,
    periodo: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """Marcaciones acotadas al alcance del rol (Empleado solo las suyas)."""
    query = db.query(Marcacion).filter(
        Marcacion.empresa_id == usuario_actual.empresa_id,
        Marcacion.is_deleted.is_(False),
    )
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None:
        query = query.filter(Marcacion.empleado_id.in_(alcance or {-1}))
    if empleado_id is not None:
        if alcance is not None and empleado_id not in alcance:
            raise HTTPException(status_code=403, detail="No tienes acceso a esas marcaciones")
        query = query.filter(Marcacion.empleado_id == empleado_id)
    if periodo:
        query = query.filter(Marcacion.periodo == periodo)
    return query.order_by(Marcacion.momento.desc()).limit(500).all()


# ============================================================================
# Fase 3 — Jornadas atípicas (Admin/RRHH)
# ============================================================================

@router.post("/ciclos", response_model=CicloJornadaResponse, status_code=status.HTTP_201_CREATED)
def crear_ciclo(
    datos: CicloJornadaCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == datos.empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado en tu empresa")

    # Solo un ciclo activo por empleado: desactivar los previos.
    db.query(CicloJornada).filter(
        CicloJornada.empleado_id == datos.empleado_id,
        CicloJornada.activo.is_(True),
        CicloJornada.is_deleted.is_(False),
    ).update({CicloJornada.activo: False}, synchronize_session=False)

    ciclo = CicloJornada(**datos.model_dump(), empresa_id=usuario_actual.empresa_id)
    db.add(ciclo)
    db.commit()
    db.refresh(ciclo)
    return ciclo


@router.get("/ciclos", response_model=List[CicloJornadaResponse])
def listar_ciclos(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"])),
):
    return db.query(CicloJornada).filter(
        CicloJornada.empresa_id == usuario_actual.empresa_id,
        CicloJornada.activo.is_(True),
        CicloJornada.is_deleted.is_(False),
    ).all()


@router.delete("/ciclos/{ciclo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_ciclo(
    ciclo_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    ciclo = db.query(CicloJornada).filter(
        CicloJornada.ciclo_id == ciclo_id,
        CicloJornada.empresa_id == usuario_actual.empresa_id,
        CicloJornada.is_deleted.is_(False),
    ).first()
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")
    ciclo.is_deleted = True
    ciclo.activo = False
    db.commit()


# ============================================================================
# Fase 3 — Conciliación y cierre mensual (Admin/RRHH)
# ============================================================================

@router.get("/conciliacion")
def previsualizar_conciliacion(
    periodo: str,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    """Segmentación calculada desde marcaciones para el periodo (sin persistir)."""
    items = conciliar_periodo(db, usuario_actual.empresa_id, periodo)
    cierre = db.query(CierreAsistencia).filter(
        CierreAsistencia.empresa_id == usuario_actual.empresa_id,
        CierreAsistencia.periodo == periodo,
    ).first()
    return {
        "periodo": periodo,
        "estado": cierre.estado if cierre else "Abierto",
        "items": items,
    }


@router.post("/conciliacion/congelar", response_model=CierreResponse)
def congelar_conciliacion(
    periodo: str,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"])),
):
    """
    Congela la asistencia del periodo: inyecta las horas segmentadas en HorasPeriodo
    (Fase 2) para que la nómina las consuma, y marca el cierre como 'Congelado'.
    """
    items = conciliar_periodo(db, usuario_actual.empresa_id, periodo)

    afectados = 0
    for it in items:
        registro = db.query(HorasPeriodo).filter(
            HorasPeriodo.empleado_id == it["empleado_id"],
            HorasPeriodo.periodo == periodo,
            HorasPeriodo.is_deleted.is_(False),
        ).first()
        if registro is None:
            registro = HorasPeriodo(
                empresa_id=usuario_actual.empresa_id,
                empleado_id=it["empleado_id"],
                periodo=periodo,
                registrado_por=usuario_actual.usuario_id,
            )
            db.add(registro)
        registro.horas_extra_25 = it["horas_extra_25"]
        registro.horas_extra_35 = it["horas_extra_35"]
        registro.horas_nocturnas = it["horas_nocturnas"]
        registro.registrado_por = usuario_actual.usuario_id
        afectados += 1

    cierre = db.query(CierreAsistencia).filter(
        CierreAsistencia.empresa_id == usuario_actual.empresa_id,
        CierreAsistencia.periodo == periodo,
    ).first()
    if cierre is None:
        cierre = CierreAsistencia(empresa_id=usuario_actual.empresa_id, periodo=periodo)
        db.add(cierre)
    cierre.estado = "Congelado"
    cierre.cerrado_por = usuario_actual.usuario_id
    cierre.fecha_cierre = datetime.now()

    db.commit()
    registrar_auditoria(db, usuario_actual.usuario_id, "CONGELAR_ASISTENCIA", "Asistencia",
                        {"periodo": periodo, "empleados_afectados": afectados})
    return CierreResponse(periodo=periodo, estado="Congelado", empleados_afectados=afectados)