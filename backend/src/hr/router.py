from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import obtener_usuario_actual, verificar_rol
from src.hr.models import Departamento, Cargo, Empleado, Contrato
from src.hr.schemas import (
    DepartamentoCreate, DepartamentoResponse,
    CargoCreate, CargoResponse,
    EmpleadoCreate, EmpleadoUpdate, EmpleadoResponse,
    ContratoCreate, ContratoResponse
)

router = APIRouter()

# ==========================================
# RF-04: GESTIÓN DE DEPARTAMENTOS Y CARGOS
# ==========================================

@router.post("/departamentos", response_model=DepartamentoResponse, status_code=status.HTTP_201_CREATED)
def crear_departamento(
    datos: DepartamentoCreate, 
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    # El payload directo de DepartamentoCreate ya no contiene parent_id
    dept = Departamento(**datos.model_dump(), empresa_id=usuario_actual.empresa_id)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.get("/departamentos", response_model=List[DepartamentoResponse])
def listar_departamentos(
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"]))
):
    return db.query(Departamento).filter(Departamento.empresa_id == usuario_actual.empresa_id).all()

@router.post("/cargos", response_model=CargoResponse, status_code=status.HTTP_201_CREATED)
def crear_cargo(
    datos: CargoCreate, 
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    cargo = Cargo(**datos.model_dump())
    db.add(cargo)
    db.commit()
    db.refresh(cargo)
    return cargo

@router.delete("/departamentos/{departamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_departamento(
    departamento_id: int, 
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    dept = db.query(Departamento).filter(Departamento.departamento_id == departamento_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")
    
    db.delete(dept)
    db.commit()
    return None

@router.get("/cargos", response_model=List[CargoResponse])
def listar_cargos(
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"]))
):
    return db.query(Cargo).join(Departamento).filter(Departamento.empresa_id == usuario_actual.empresa_id).all()

# ==========================================
# RF-05: DIRECTORIO DE EMPLEADOS
# ==========================================

@router.post("/", response_model=EmpleadoResponse, status_code=status.HTTP_201_CREATED)
def crear_empleado(
    datos: EmpleadoCreate, 
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    if db.query(Empleado).filter(Empleado.usuario_id == datos.usuario_id).first():
        raise HTTPException(status_code=409, detail="El usuario ya tiene un perfil de empleado")

    empleado = Empleado(**datos.model_dump(), empresa_id=usuario_actual.empresa_id)
    db.add(empleado)
    db.commit()
    db.refresh(empleado)
    return empleado

@router.get("/", response_model=List[EmpleadoResponse])
def listar_empleados(
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"]))
):
    return db.query(Empleado).filter(Empleado.empresa_id == usuario_actual.empresa_id).all()

@router.patch("/{empleado_id}", response_model=EmpleadoResponse)
def actualizar_empleado(
    empleado_id: int, 
    datos: EmpleadoUpdate, 
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == empleado_id, 
        Empleado.empresa_id == usuario_actual.empresa_id
    ).first()
    
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    # =========================================================================
    # LÓGICA DE CONTROL TRANSACCIONAL DE VIGENCIAS (RF-05 / RF-06)
    # =========================================================================
    
    # CASO A: BAJA LOGICA (De Activo a Inactivo) -> Vencer contratos activos
    if datos.estado == "Inactivo" and empleado.estado != "Inactivo":
        contratos_activos = db.query(Contrato).filter(
            Contrato.empleado_id == empleado_id,
            Contrato.estado == "Vigente"
        ).all()
        for contrato in contratos_activos:
            contrato.estado = "Vencido"

    # CASO B: RECONEXIÓN/ALTA (De Inactivo a Activo) -> Reactivar último contrato
    elif datos.estado == "Activo" and empleado.estado == "Inactivo":
        # Buscamos el último contrato emitido para este colaborador
        ultimo_contrato = db.query(Contrato).filter(
            Contrato.empleado_id == empleado_id
        ).order_by(Contrato.fecha_creacion.desc()).first()
        
        if ultimo_contrato:
            ultimo_contrato.estado = "Vigente"
            
    # =========================================================================

    # Mapeo reflectivo para el resto de propiedades
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(empleado, campo, valor)

    db.commit()
    db.refresh(empleado)
    return empleado

@router.delete("/{empleado_id}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_empleado(
    empleado_id: int, 
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    """
    Mantiene compatibilidad con borrado lógico directo.
    También gatilla el vencimiento de contratos por seguridad de negocio.
    """
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == empleado_id, 
        Empleado.empresa_id == usuario_actual.empresa_id
    ).first()
    
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    
    if empleado.estado != "Inactivo":
        contratos_activos = db.query(Contrato).filter(
            Contrato.empleado_id == empleado_id,
            Contrato.estado == "Vigente"
        ).all()
        for contrato in contratos_activos:
            contrato.estado = "Vencido"
            
    empleado.estado = "Inactivo"
    db.commit()
    return None

@router.get("/usuarios-disponibles")
def listar_usuarios_sin_empleado(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """
    RF-05: Devuelve la lista de cuentas de usuario pertenecientes a la empresa
    que aún no tienen un registro asignado en la tabla de empleados.
    """
    # Buscamos usuarios de la misma empresa con un LEFT JOIN donde el empleado_id sea NULL
    usuarios_libres = db.query(Usuario).outerjoin(Empleado, Usuario.usuario_id == Empleado.usuario_id)\
        .filter(
            Usuario.empresa_id == usuario_actual.empresa_id,
            Empleado.empleado_id == None
        ).all()
        
    return [
        {
            "usuario_id": u.usuario_id,
            "nombre": u.nombre,
            "correo": u.correo
        }
        for u in usuarios_libres
    ]
# ==========================================
# RF-06: GESTIÓN DE CONTRATOS
# ==========================================

@router.post("/contratos", response_model=ContratoResponse, status_code=status.HTTP_201_CREATED)
def crear_contrato(
    datos: ContratoCreate, 
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    # Al crear un nuevo contrato, los contratos anteriores vigentes deben vencer
    contratos_viejos = db.query(Contrato).filter(
        Contrato.empleado_id == datos.empleado_id, 
        Contrato.estado == "Vigente"
    ).all()
    
    for c in contratos_viejos:
        c.estado = "Vencido"
        
    contrato = Contrato(**datos.model_dump())
    db.add(contrato)
    db.commit()
    db.refresh(contrato)
    return contrato

@router.get("/contratos", response_model=List[ContratoResponse])
def listar_todos_los_contratos(
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"]))
):
    """
    RF-06: Permite al panel de administración leer el historial completo 
    de contratos emitidos en la empresa para llenar la tabla general.
    """
    return db.query(Contrato).order_by(Contrato.fecha_creacion.desc()).all()

@router.get("/contratos/{empleado_id}", response_model=List[ContratoResponse])
def listar_contratos(
    empleado_id: int, 
    db: Session = Depends(get_db), 
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"]))
):
    return db.query(Contrato).filter(Contrato.empleado_id == empleado_id).order_by(Contrato.fecha_inicio.desc()).all()

@router.get("/mantenimiento/limpiar-contratos-viejos")
def limpiar_contratos_retroactivos(db: Session = Depends(get_db)):
    """
    Ruta temporal de administración para corregir contratos de empleados 
    que fueron dados de baja antes de implementar las restricciones del Sprint 2.
    """
    # Buscamos todos los contratos vigentes cuyos empleados estén inactivos
    contratos_huerfanos = db.query(Contrato).join(Empleado).filter(
        Contrato.estado == "Vigente",
        Empleado.estado == "Inactivo"
    ).all()
    
    contador = len(contratos_huerfanos)
    
    # Los pasamos a vencidos
    for contrato in contratos_huerfanos:
        contrato.estado = "Vencido"
        
    db.commit()
    return {"status": "success", "mensaje": f"Se corrigieron {contador} contratos antiguos con éxito."}