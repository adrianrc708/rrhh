from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from src.database import get_db
from src.core.models import Usuario
from src.core.dependencies import (
    obtener_usuario_actual, verificar_rol,
    alcance_empleados, obtener_ids_subordinados,   # ← Fase 1: aislamiento jerárquico
)
from src.core.services import registrar_auditoria          # ← NUEVO
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
    dept = Departamento(**datos.model_dump(), empresa_id=usuario_actual.empresa_id)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    registrar_auditoria(db, usuario_actual.usuario_id, "CREAR_DEPARTAMENTO", "HR",
                        {"departamento_id": dept.departamento_id, "nombre": dept.nombre})
    return dept

@router.get("/departamentos", response_model=List[DepartamentoResponse])
def listar_departamentos(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"]))
):
    return db.query(Departamento).filter(
        Departamento.empresa_id == usuario_actual.empresa_id,
        Departamento.is_deleted.is_(False),
    ).all()

@router.post("/cargos", response_model=CargoResponse, status_code=status.HTTP_201_CREATED)
def crear_cargo(
    datos: CargoCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    # Seguridad multi-tenant: el departamento debe pertenecer a la empresa del usuario.
    dept = db.query(Departamento).filter(
        Departamento.departamento_id == datos.departamento_id,
        Departamento.empresa_id == usuario_actual.empresa_id,
        Departamento.is_deleted.is_(False),
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Departamento no encontrado en tu empresa")

    cargo = Cargo(**datos.model_dump())
    db.add(cargo)
    db.commit()
    db.refresh(cargo)

    registrar_auditoria(db, usuario_actual.usuario_id, "CREAR_CARGO", "HR",
                        {"cargo_id": cargo.cargo_id, "nombre": cargo.nombre})
    return cargo

@router.delete("/departamentos/{departamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_departamento(
    departamento_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    dept = db.query(Departamento).filter(
        Departamento.departamento_id == departamento_id,
        Departamento.empresa_id == usuario_actual.empresa_id,
        Departamento.is_deleted.is_(False),
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")

    registrar_auditoria(db, usuario_actual.usuario_id, "ELIMINAR_DEPARTAMENTO", "HR",
                        {"departamento_id": departamento_id, "nombre": dept.nombre})
    # Fase 1: borrado lógico (no se destruyen cargos/empleados en cascada).
    dept.is_deleted = True
    db.commit()
    return None

@router.get("/cargos", response_model=List[CargoResponse])
def listar_cargos(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"]))
):
    return db.query(Cargo).join(Departamento).filter(
        Departamento.empresa_id == usuario_actual.empresa_id,
        Cargo.is_deleted.is_(False),
        Departamento.is_deleted.is_(False),
    ).all()

# ==========================================
# RF-05: DIRECTORIO DE EMPLEADOS
# ==========================================

@router.post("/", response_model=EmpleadoResponse, status_code=status.HTTP_201_CREATED)
def crear_empleado(
    datos: EmpleadoCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    if db.query(Empleado).filter(
        Empleado.usuario_id == datos.usuario_id,
        Empleado.is_deleted.is_(False),
    ).first():
        raise HTTPException(status_code=409, detail="El usuario ya tiene un perfil de empleado")

    # Seguridad multi-tenant: el jefe asignado debe pertenecer a la misma empresa.
    if datos.jefe_id is not None:
        jefe = db.query(Empleado).filter(
            Empleado.empleado_id == datos.jefe_id,
            Empleado.empresa_id == usuario_actual.empresa_id,
            Empleado.is_deleted.is_(False),
        ).first()
        if not jefe:
            raise HTTPException(status_code=404, detail="El jefe asignado no existe en tu empresa")

    empleado = Empleado(**datos.model_dump(), empresa_id=usuario_actual.empresa_id)
    db.add(empleado)
    db.commit()
    db.refresh(empleado)

    # RF-16: auditoría de alta
    registrar_auditoria(db, usuario_actual.usuario_id, "CREAR_EMPLEADO", "HR",
                        {"empleado_id": empleado.empleado_id, "nombre": empleado.nombre})
    return empleado

@router.get("/", response_model=List[EmpleadoResponse])
def listar_empleados(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"]))
):
    query = db.query(Empleado).filter(
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
    )
    # Fase 1: el Gerente solo ve su propio subárbol; Admin/RRHH ven toda la empresa.
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None:
        query = query.filter(Empleado.empleado_id.in_(alcance or {-1}))
    return query.all()

@router.patch("/{empleado_id}", response_model=EmpleadoResponse)
def actualizar_empleado(
    empleado_id: int,
    datos: EmpleadoUpdate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
    ).first()

    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    # Validar reasignación de jefe: debe ser de la misma empresa y no generar ciclo.
    if "jefe_id" in datos.model_dump(exclude_unset=True) and datos.jefe_id is not None:
        if datos.jefe_id == empleado_id:
            raise HTTPException(status_code=400, detail="Un empleado no puede ser su propio jefe")
        jefe = db.query(Empleado).filter(
            Empleado.empleado_id == datos.jefe_id,
            Empleado.empresa_id == usuario_actual.empresa_id,
            Empleado.is_deleted.is_(False),
        ).first()
        if not jefe:
            raise HTTPException(status_code=404, detail="El jefe asignado no existe en tu empresa")
        # Evitar ciclos: el nuevo jefe no puede estar dentro del subárbol del empleado.
        if datos.jefe_id in obtener_ids_subordinados(db, empleado_id, incluir_self=True):
            raise HTTPException(status_code=400, detail="Asignación inválida: generaría un ciclo jerárquico")

    # CASO A: BAJA LOGICA
    if datos.estado == "Inactivo" and empleado.estado != "Inactivo":
        contratos_activos = db.query(Contrato).filter(
            Contrato.empleado_id == empleado_id,
            Contrato.estado == "Vigente",
            Contrato.is_deleted.is_(False),
        ).all()
        for contrato in contratos_activos:
            contrato.estado = "Vencido"

    # CASO B: REACTIVACIÓN
    elif datos.estado == "Activo" and empleado.estado == "Inactivo":
        ultimo_contrato = db.query(Contrato).filter(
            Contrato.empleado_id == empleado_id,
            Contrato.is_deleted.is_(False),
        ).order_by(Contrato.fecha_creacion.desc()).first()
        if ultimo_contrato:
            ultimo_contrato.estado = "Vigente"

    estado_anterior = empleado.estado
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(empleado, campo, valor)

    db.commit()
    db.refresh(empleado)

    # RF-16: auditoría de edición
    registrar_auditoria(db, usuario_actual.usuario_id, "EDITAR_EMPLEADO", "HR",
                        {"empleado_id": empleado_id, "estado_anterior": estado_anterior,
                         "estado_nuevo": empleado.estado, "campos": list(datos.model_dump(exclude_unset=True).keys())})
    return empleado

@router.delete("/{empleado_id}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_empleado(
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH"]))
):
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
    ).first()

    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    if empleado.estado != "Inactivo":
        contratos_activos = db.query(Contrato).filter(
            Contrato.empleado_id == empleado_id,
            Contrato.estado == "Vigente",
            Contrato.is_deleted.is_(False),
        ).all()
        for contrato in contratos_activos:
            contrato.estado = "Vencido"

    empleado.estado = "Inactivo"
    db.commit()

    # RF-16: auditoría de baja
    registrar_auditoria(db, usuario_actual.usuario_id, "BAJA_EMPLEADO", "HR",
                        {"empleado_id": empleado_id, "nombre": empleado.nombre})
    return None

@router.get("/usuarios-disponibles")
def listar_usuarios_sin_empleado(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    usuarios_libres = db.query(Usuario).outerjoin(
            Empleado,
            (Usuario.usuario_id == Empleado.usuario_id) & (Empleado.is_deleted.is_(False)),
        )\
        .filter(
            Usuario.empresa_id == usuario_actual.empresa_id,
            Usuario.is_deleted.is_(False),
            Empleado.empleado_id == None
        ).all()

    return [
        {"usuario_id": u.usuario_id, "nombre": u.nombre, "correo": u.correo}
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
    from src.core.fiscal import PERFILES_CONTRATO
    if datos.perfil_contrato not in PERFILES_CONTRATO:
        raise HTTPException(status_code=400, detail=f"Perfil de contrato inválido. Opciones: {', '.join(PERFILES_CONTRATO)}")

    # Seguridad multi-tenant: el empleado del contrato debe ser de la misma empresa.
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == datos.empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado en tu empresa")

    contratos_viejos = db.query(Contrato).filter(
        Contrato.empleado_id == datos.empleado_id,
        Contrato.estado == "Vigente",
        Contrato.is_deleted.is_(False),
    ).all()
    for c in contratos_viejos:
        c.estado = "Vencido"

    contrato = Contrato(**datos.model_dump())
    db.add(contrato)
    db.commit()
    db.refresh(contrato)

    registrar_auditoria(db, usuario_actual.usuario_id, "CREAR_CONTRATO", "HR",
                        {"contrato_id": contrato.contrato_id, "empleado_id": datos.empleado_id,
                         "tipo_contrato": datos.tipo_contrato, "sueldo_base": float(datos.sueldo_base)})
    return contrato

@router.get("/contratos", response_model=List[ContratoResponse])
def listar_todos_los_contratos(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente"]))
):
    # ANTES: devolvía TODOS los contratos de TODAS las empresas (fuga multi-tenant).
    # Ahora se acota a la empresa del usuario y al alcance jerárquico de su rol.
    query = db.query(Contrato).join(Empleado, Contrato.empleado_id == Empleado.empleado_id).filter(
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
        Contrato.is_deleted.is_(False),
    )
    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None:
        query = query.filter(Contrato.empleado_id.in_(alcance or {-1}))
    return query.order_by(Contrato.fecha_creacion.desc()).all()

@router.get("/contratos/{empleado_id}", response_model=List[ContratoResponse])
def listar_contratos(
    empleado_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin", "RRHH", "Gerente", "Empleado"]))
):
    # Cierre de IDOR: el empleado objetivo debe existir en la empresa del usuario
    # y estar dentro de su alcance (un Empleado solo ve lo suyo; un Gerente su equipo).
    empleado = db.query(Empleado).filter(
        Empleado.empleado_id == empleado_id,
        Empleado.empresa_id == usuario_actual.empresa_id,
        Empleado.is_deleted.is_(False),
    ).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    alcance = alcance_empleados(db, usuario_actual)
    if alcance is not None and empleado_id not in alcance:
        raise HTTPException(status_code=403, detail="No tienes acceso a los contratos de este empleado")

    return db.query(Contrato).filter(
        Contrato.empleado_id == empleado_id,
        Contrato.is_deleted.is_(False),
    ).order_by(Contrato.fecha_inicio.desc()).all()

@router.get("/mantenimiento/limpiar-contratos-viejos")
def limpiar_contratos_retroactivos(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(verificar_rol(["Admin"])),
):
    # ANTES: endpoint sin autenticación. Ahora solo Admin/SuperAdmin y acotado a la empresa.
    contratos_huerfanos = db.query(Contrato).join(Empleado).filter(
        Contrato.estado == "Vigente",
        Contrato.is_deleted.is_(False),
        Empleado.estado == "Inactivo",
        Empleado.empresa_id == usuario_actual.empresa_id,
    ).all()
    contador = len(contratos_huerfanos)
    for contrato in contratos_huerfanos:
        contrato.estado = "Vencido"
    db.commit()
    return {"status": "success", "mensaje": f"Se corrigieron {contador} contratos antiguos con éxito."}