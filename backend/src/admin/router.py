from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta

from src.database import get_db
from src.core.models import Empresa, Usuario
from src.core.dependencies import verificar_rol
from src.core.security import obtener_password_hash, crear_token_acceso
from src.admin.schemas import (
    EmpresaAdminResponse, AdminStatsResponse, 
    EmpresaCreate, EmpresaUpdate, 
    UsuarioAdminResponse, UsuarioSuperAdminCreate
)

router = APIRouter()

@router.get("/stats", response_model=AdminStatsResponse)
def obtener_estadisticas_globales(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    total_empresas = db.query(Empresa).count()
    total_usuarios = db.query(Usuario).count()
    activas = db.query(Empresa).filter(Empresa.estado == "Activa").count()
    total_superadmins = db.query(Usuario).filter(Usuario.rol == "SuperAdmin").count()
    
    # Agrupar por plan
    planes_db = db.query(Empresa.plan_suscripcion).all()
    planes_count = {}
    for (plan,) in planes_db:
        planes_count[plan] = planes_count.get(plan, 0) + 1
        
    return {
        "total_empresas": total_empresas,
        "total_usuarios": total_usuarios,
        "empresas_por_plan": planes_count,
        "empresas_activas": activas,
        "total_superadmins": total_superadmins
    }

@router.get("/empresas", response_model=List[EmpresaAdminResponse])
def obtener_empresas_superadmin(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    empresas = db.query(Empresa).all()
    resultado = []
    
    for emp in empresas:
        usuarios = db.query(Usuario).filter(Usuario.empresa_id == emp.empresa_id).all()
        
        emp_data = EmpresaAdminResponse(
            empresa_id=emp.empresa_id,
            razon_social=emp.razon_social,
            ruc=emp.ruc,
            plan_suscripcion=emp.plan_suscripcion,
            estado=emp.estado,
            fecha_registro=emp.fecha_registro,
            usuarios=usuarios
        )
        resultado.append(emp_data)
        
    return resultado

@router.post("/empresas", response_model=EmpresaAdminResponse)
def crear_empresa(
    datos: EmpresaCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    if db.query(Empresa).filter(Empresa.ruc == datos.ruc).first():
        raise HTTPException(status_code=400, detail="RUC ya existe")
        
    nueva = Empresa(
        razon_social=datos.razon_social,
        ruc=datos.ruc,
        plan_suscripcion=datos.plan_suscripcion,
        estado=datos.estado
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    
    return EmpresaAdminResponse(
        empresa_id=nueva.empresa_id,
        razon_social=nueva.razon_social,
        ruc=nueva.ruc,
        plan_suscripcion=nueva.plan_suscripcion,
        estado=nueva.estado,
        fecha_registro=nueva.fecha_registro,
        usuarios=[]
    )

@router.put("/empresas/{empresa_id}", response_model=EmpresaAdminResponse)
def actualizar_empresa(
    empresa_id: int,
    datos: EmpresaUpdate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    empresa = db.query(Empresa).filter(Empresa.empresa_id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
        
    if datos.razon_social is not None:
        empresa.razon_social = datos.razon_social
    if datos.ruc is not None:
        if datos.ruc != empresa.ruc and db.query(Empresa).filter(Empresa.ruc == datos.ruc).first():
            raise HTTPException(status_code=400, detail="RUC ya en uso")
        empresa.ruc = datos.ruc
    if datos.plan_suscripcion is not None:
        empresa.plan_suscripcion = datos.plan_suscripcion
    if datos.estado is not None:
        empresa.estado = datos.estado
        
    db.commit()
    db.refresh(empresa)
    
    usuarios = db.query(Usuario).filter(Usuario.empresa_id == empresa.empresa_id).all()
    
    return EmpresaAdminResponse(
        empresa_id=empresa.empresa_id,
        razon_social=empresa.razon_social,
        ruc=empresa.ruc,
        plan_suscripcion=empresa.plan_suscripcion,
        estado=empresa.estado,
        fecha_registro=empresa.fecha_registro,
        usuarios=usuarios
    )

@router.delete("/empresas/{empresa_id}")
def eliminar_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    empresa = db.query(Empresa).filter(Empresa.empresa_id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    db.delete(empresa)
    db.commit()
    return {"detail": "Empresa eliminada correctamente"}

@router.post("/empresas/{empresa_id}/usuarios", response_model=UsuarioAdminResponse)
def crear_usuario_empresa(
    empresa_id: int,
    datos: UsuarioSuperAdminCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    empresa = db.query(Empresa).filter(Empresa.empresa_id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
        
    if db.query(Usuario).filter(Usuario.correo == datos.correo).first():
        raise HTTPException(status_code=400, detail="Correo ya en uso")
        
    nuevo = Usuario(
        empresa_id=empresa_id,
        nombre=datos.nombre,
        correo=datos.correo,
        password_hash=obtener_password_hash(datos.password),
        rol=datos.rol,
        estado="Activo"
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.delete("/usuarios/{usuario_id}")
def eliminar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    # Evitar auto-eliminarse
    if usuario_actual.usuario_id == usuario_id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
        
    usuario = db.query(Usuario).filter(Usuario.usuario_id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    db.delete(usuario)
    db.commit()
    return {"detail": "Usuario eliminado correctamente"}

@router.post("/impersonate/{usuario_id}")
def impersonate_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    """Genera un JWT válido como si el SuperAdmin fuera el usuario_id indicado."""
    usuario = db.query(Usuario).filter(Usuario.usuario_id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario objetivo no encontrado")
        
    token = crear_token_acceso(
        data={"sub": usuario.correo, "empresa_id": usuario.empresa_id},
        expires_delta=timedelta(minutes=60),
    )
    
    return {
        "access_token": token, 
        "token_type": "bearer",
        "usuario": {
            "nombre": usuario.nombre,
            "correo": usuario.correo,
            "rol": usuario.rol
        }
    }
