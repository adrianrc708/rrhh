from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from src.database import get_db
from src.core.models import Empresa, Usuario
from src.core.dependencies import verificar_rol
from src.admin.schemas import EmpresaAdminResponse

router = APIRouter()

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
            fecha_registro=emp.fecha_registro,
            usuarios=usuarios
        )
        resultado.append(emp_data)
        
    return resultado
