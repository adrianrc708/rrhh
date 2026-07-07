from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta, date

from src.database import get_db
from src.core.models import Empresa, Usuario, ParametroFiscal
from src.core.dependencies import verificar_rol
from src.core.security import obtener_password_hash, crear_token_acceso
from src.core.fiscal import cargar_parametros_fiscales, DESCRIPCIONES
from src.admin.schemas import (
    EmpresaAdminResponse, AdminStatsResponse,
    EmpresaCreate, EmpresaUpdate,
    UsuarioAdminResponse, UsuarioSuperAdminCreate,
    ParametroFiscalCreate, ParametroFiscalResponse, ParametroFiscalVigenteResponse,
)

router = APIRouter()

@router.get("/stats", response_model=AdminStatsResponse)
def obtener_estadisticas_globales(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    total_empresas = db.query(Empresa).filter(Empresa.is_deleted.is_(False)).count()
    total_usuarios = db.query(Usuario).filter(Usuario.is_deleted.is_(False)).count()
    activas = db.query(Empresa).filter(
        Empresa.estado == "Activa", Empresa.is_deleted.is_(False)
    ).count()
    total_superadmins = db.query(Usuario).filter(
        Usuario.rol == "SuperAdmin", Usuario.is_deleted.is_(False)
    ).count()

    # Agrupar por plan
    planes_db = db.query(Empresa.plan_suscripcion).filter(Empresa.is_deleted.is_(False)).all()
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
    empresas = db.query(Empresa).filter(Empresa.is_deleted.is_(False)).all()
    resultado = []

    for emp in empresas:
        usuarios = db.query(Usuario).filter(
            Usuario.empresa_id == emp.empresa_id,
            Usuario.is_deleted.is_(False),
        ).all()
        
        emp_data = EmpresaAdminResponse(
            empresa_id=emp.empresa_id,
            razon_social=emp.razon_social,
            ruc=emp.ruc,
            plan_suscripcion=emp.plan_suscripcion,
            estado=emp.estado,
            regimen_laboral=emp.regimen_laboral,
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
        estado=datos.estado,
        regimen_laboral=datos.regimen_laboral,
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
        regimen_laboral=nueva.regimen_laboral,
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
    empresa = db.query(Empresa).filter(
        Empresa.empresa_id == empresa_id, Empresa.is_deleted.is_(False)
    ).first()
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
    if datos.regimen_laboral is not None:
        empresa.regimen_laboral = datos.regimen_laboral

    db.commit()
    db.refresh(empresa)

    usuarios = db.query(Usuario).filter(
        Usuario.empresa_id == empresa.empresa_id, Usuario.is_deleted.is_(False)
    ).all()

    return EmpresaAdminResponse(
        empresa_id=empresa.empresa_id,
        razon_social=empresa.razon_social,
        ruc=empresa.ruc,
        plan_suscripcion=empresa.plan_suscripcion,
        estado=empresa.estado,
        regimen_laboral=empresa.regimen_laboral,
        fecha_registro=empresa.fecha_registro,
        usuarios=usuarios
    )

@router.delete("/empresas/{empresa_id}")
def eliminar_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    empresa = db.query(Empresa).filter(
        Empresa.empresa_id == empresa_id, Empresa.is_deleted.is_(False)
    ).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    # Fase 1: borrado lógico. No se destruyen usuarios/contratos/planillas en cascada;
    # se archiva la empresa y se bloquea el acceso de sus usuarios.
    empresa.is_deleted = True
    db.query(Usuario).filter(Usuario.empresa_id == empresa_id).update(
        {Usuario.is_deleted: True}, synchronize_session=False
    )
    db.commit()
    return {"detail": "Empresa archivada correctamente (borrado lógico)"}

@router.post("/empresas/{empresa_id}/usuarios", response_model=UsuarioAdminResponse)
def crear_usuario_empresa(
    empresa_id: int,
    datos: UsuarioSuperAdminCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    empresa = db.query(Empresa).filter(
        Empresa.empresa_id == empresa_id, Empresa.is_deleted.is_(False)
    ).first()
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
        
    usuario = db.query(Usuario).filter(
        Usuario.usuario_id == usuario_id, Usuario.is_deleted.is_(False)
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Fase 1: borrado lógico (preserva su historial de contratos/planillas).
    usuario.is_deleted = True
    db.commit()
    return {"detail": "Usuario archivado correctamente (borrado lógico)"}

@router.post("/impersonate/{usuario_id}")
def impersonate_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"]))
):
    """Genera un JWT válido como si el SuperAdmin fuera el usuario_id indicado."""
    usuario = db.query(Usuario).filter(
        Usuario.usuario_id == usuario_id, Usuario.is_deleted.is_(False)
    ).first()
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


# ==========================================================================
# Fase 1: Parámetros fiscales (RMV, UIT, tasas). Globales, afectan a todas las
# empresas. Solo SuperAdmin. Se mantiene registro histórico de vigencias.
# ==========================================================================

@router.get("/parametros/vigentes", response_model=List[ParametroFiscalVigenteResponse])
def obtener_parametros_vigentes(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"])),
):
    """Resumen de los valores actualmente vigentes (incluye defaults si faltan en BD)."""
    valores = cargar_parametros_fiscales(db)
    return [
        ParametroFiscalVigenteResponse(
            clave=clave, valor=valor, descripcion=DESCRIPCIONES.get(clave)
        )
        for clave, valor in valores.items()
    ]


@router.get("/parametros", response_model=List[ParametroFiscalResponse])
def listar_historial_parametros(
    clave: str = None,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"])),
):
    """Historial completo de vigencias (opcionalmente filtrado por clave)."""
    query = db.query(ParametroFiscal)
    if clave:
        query = query.filter(ParametroFiscal.clave == clave)
    return query.order_by(
        ParametroFiscal.clave.asc(), ParametroFiscal.vigencia_desde.desc()
    ).all()


@router.post("/parametros", response_model=ParametroFiscalResponse, status_code=status.HTTP_201_CREATED)
def crear_parametro_fiscal(
    datos: ParametroFiscalCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["SuperAdmin"])),
):
    """
    Registra una nueva vigencia para una clave. Cierra automáticamente la vigencia
    anterior abierta (vigencia_hasta = vigencia_desde - 1 día), preservando el
    historial. La nueva fila queda como la vigente.
    """
    from datetime import timedelta as _td

    if datos.vigencia_desde is None:
        raise HTTPException(status_code=400, detail="vigencia_desde es obligatoria")

    # Cerrar vigencias abiertas anteriores de la misma clave.
    abiertas = db.query(ParametroFiscal).filter(
        ParametroFiscal.clave == datos.clave,
        ParametroFiscal.activo.is_(True),
        ParametroFiscal.vigencia_hasta.is_(None),
    ).all()
    for fila in abiertas:
        if fila.vigencia_desde >= datos.vigencia_desde:
            # Vigencia previa empieza después de la nueva: se desactiva (corrección).
            fila.activo = False
        else:
            fila.vigencia_hasta = datos.vigencia_desde - _td(days=1)

    nuevo = ParametroFiscal(
        clave=datos.clave,
        valor=datos.valor,
        descripcion=datos.descripcion or DESCRIPCIONES.get(datos.clave),
        vigencia_desde=datos.vigencia_desde,
        vigencia_hasta=None,
        activo=True,
        creado_por=usuario_actual.usuario_id,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo
