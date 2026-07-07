from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime
from fastapi import HTTPException, status

from src.core.models import Nomina, DetalleNomina, HistorialAprobacion, Usuario, Empresa, HorasPeriodo
from src.hr.models import Empleado, Contrato
from src.attendance.models import Inasistencia, TIPOS_QUE_DESCUENTAN
from src.payroll.calculations import calcular_planilla_empleado
from src.core.fiscal import cargar_parametros_fiscales
from src.payroll.compliance import auditar_prenomina, contar_bloqueos
from src.payroll.conceptos_models import ConceptoVariable
from src.payroll.conceptos_calculo import calcular_aplicacion_periodo

# RF-13: Máquina de estados
TRANSICIONES_VALIDAS = {
    "Borrador": ["Revision"],
    "Revision": ["Aprobado", "Borrador"],
    "Aprobado": ["Pagado", "Revision"],
    "Pagado": [],
}

ROLES_POR_TRANSICION = {
    ("Borrador", "Revision"): ["Admin", "RRHH"],
    ("Revision", "Aprobado"): ["Admin", "Gerente"],
    ("Revision", "Borrador"): ["Admin", "Gerente"],
    ("Aprobado", "Pagado"): ["Admin"],
    ("Aprobado", "Revision"): ["Admin"],
}

ESTADOS_BLOQUEADOS = {"Aprobado", "Pagado"}


def verificar_nomina_editable(nomina: Nomina) -> None:
    """RF-13: Lanza excepción si la nómina está bloqueada."""
    if nomina.estado in ESTADOS_BLOQUEADOS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La nómina en estado '{nomina.estado}' no puede modificarse.",
        )


def cambiar_estado_nomina(
    db: Session,
    nomina: Nomina,
    nuevo_estado: str,
    usuario: Usuario,
    comentarios: str = None,
) -> Nomina:
    """RF-13: Valida transición, rol y persiste el cambio con historial."""
    estado_actual = nomina.estado

    destinos_validos = TRANSICIONES_VALIDAS.get(estado_actual, [])
    if nuevo_estado not in destinos_validos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Transición inválida: '{estado_actual}' → '{nuevo_estado}'. "
                f"Desde '{estado_actual}' se puede ir a: {destinos_validos or 'ningún estado'}"
            ),
        )

    roles_permitidos = ROLES_POR_TRANSICION.get((estado_actual, nuevo_estado), [])
    if usuario.rol not in roles_permitidos:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"El rol '{usuario.rol}' no puede realizar la transición '{estado_actual}' → '{nuevo_estado}'.",
        )

    # Fase 2: la auditoría normativa impide aprobar una planilla con bloqueos legales.
    if nuevo_estado == "Aprobado":
        alertas = auditar_prenomina(db, nomina)
        bloqueos = [a for a in alertas if a["nivel"] == "bloqueo"]
        if bloqueos:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "mensaje": "No se puede aprobar: la auditoría normativa detectó bloqueos legales.",
                    "bloqueos": bloqueos,
                },
            )

    db.add(HistorialAprobacion(
        nomina_id=nomina.id,
        usuario_id=usuario.usuario_id,
        estado_anterior=estado_actual,
        estado_nuevo=nuevo_estado,
        comentarios=comentarios,
    ))

    nomina.estado = nuevo_estado
    if nuevo_estado == "Aprobado":
        nomina.fecha_aprobacion = datetime.utcnow()
        nomina.aprobado_por = usuario.usuario_id

    db.commit()
    db.refresh(nomina)
    return nomina


def consolidar_nomina(db: Session, nomina: Nomina, empresa_id: int) -> dict:
    """
    RF-11 + RF-12 + RF-17:
    - Lee todos los empleados activos de la empresa
    - Lee sus inasistencias del periodo (RF-17)
    - Calcula la planilla completa con el motor (RF-11)
    - Persiste DetalleNomina por empleado y actualiza totales en Nomina (RF-12)
    """
    verificar_nomina_editable(nomina)

    # Fase 1: parámetros fiscales vigentes (RMV/UIT/tasas) desde la BD.
    parametros_fiscales = cargar_parametros_fiscales(db)
    # Fase 2: régimen laboral de la empresa (afecta EsSalud/beneficios).
    empresa = db.query(Empresa).filter(Empresa.empresa_id == empresa_id).first()
    regimen = empresa.regimen_laboral if empresa else "General"

    empleados = db.query(Empleado).filter(
        Empleado.empresa_id == empresa_id,
        Empleado.estado == "Activo",
        Empleado.is_deleted.is_(False),
    ).all()

    if not empleados:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay empleados activos para procesar en esta empresa.",
        )

    periodo = nomina.periodo  # YYYY-MM

    # Limpiar detalles previos si se reconsolida en estado Borrador
    db.query(DetalleNomina).filter(DetalleNomina.nomina_id == nomina.id).delete()
    db.flush()

    total_ingresos = Decimal("0")
    total_descuentos = Decimal("0")
    total_neto = Decimal("0")
    total_essalud = Decimal("0")

    for empleado in empleados:
        # Sueldo y horas viven en el Contrato vigente, no en Empleado
        contrato = db.query(Contrato).filter(
            Contrato.empleado_id == empleado.empleado_id,
            Contrato.estado == "Vigente",
            Contrato.is_deleted.is_(False),
        ).first()

        if not contrato:
            continue  # Empleado sin contrato vigente: se omite de la planilla

        # RF-17: obtener inasistencias que generan descuento para el periodo
        inasistencias = db.query(Inasistencia).filter(
            Inasistencia.empleado_id == empleado.empleado_id,
            Inasistencia.periodo == periodo,
        ).all()

        horas_a_descontar = sum(
            float(i.horas_ausentes)
            for i in inasistencias
            if i.tipo in TIPOS_QUE_DESCUENTAN
        )

        # Fase 2: horas de sobretiempo/nocturnas capturadas para el periodo (puente
        # manual; en Fase 3 las rellenará el Kiosco facial).
        horas = db.query(HorasPeriodo).filter(
            HorasPeriodo.empleado_id == empleado.empleado_id,
            HorasPeriodo.periodo == periodo,
            HorasPeriodo.is_deleted.is_(False),
        ).first()

        # Fase 5: comisiones (haber) y cuota de adelantos/préstamos (descuento) del periodo.
        conceptos = db.query(ConceptoVariable).filter(
            ConceptoVariable.empleado_id == empleado.empleado_id,
            ConceptoVariable.is_deleted.is_(False),
        ).all()
        aplicacion = calcular_aplicacion_periodo(conceptos, periodo)

        # RF-11 + Fase 2: motor de cálculo
        resultado = calcular_planilla_empleado(
            sueldo_base=Decimal(str(contrato.sueldo_base)),
            horas_contrato_mes=Decimal(str(contrato.horas_contrato_mes or 160)),
            horas_ausentes_injustificadas=Decimal(str(horas_a_descontar)),
            tipo_pension=empleado.tipo_pension or "ONP",
            porcentaje_afp=Decimal(str(empleado.porcentaje_afp)) if empleado.porcentaje_afp else None,
            params=parametros_fiscales,
            perfil_contrato=contrato.perfil_contrato or "Comun",
            haberes=aplicacion["comision"],
            horas_extra_25=Decimal(str(horas.horas_extra_25)) if horas else Decimal("0"),
            horas_extra_35=Decimal(str(horas.horas_extra_35)) if horas else Decimal("0"),
            horas_nocturnas=Decimal(str(horas.horas_nocturnas)) if horas else Decimal("0"),
            regimen=regimen,
        )

        # Los adelantos/préstamos recuperan dinero ya entregado: se descuentan
        # directo del neto, sin afectar la remuneración computable de pensión/IR.
        descuento_prestamos = aplicacion["descuento_prestamos"]
        descuentos_totales = resultado["total_descuentos"] + descuento_prestamos
        sueldo_neto_final = resultado["sueldo_neto"] - descuento_prestamos

        db.add(DetalleNomina(
            nomina_id=nomina.id,
            usuario_id=empleado.usuario_id,
            horas_contrato_mes=resultado["horas_contrato_mes"],
            horas_trabajadas=resultado["horas_trabajadas"],
            horas_ausentes=resultado["horas_ausentes"],
            sueldo_base=resultado["sueldo_base"],
            haberes=resultado["haberes"],
            perfil_contrato=resultado["perfil_contrato"],
            pago_horas_extra_25=resultado["pago_horas_extra_25"],
            pago_horas_extra_35=resultado["pago_horas_extra_35"],
            pago_horas_nocturnas=resultado["pago_horas_nocturnas"],
            bonos_sector=resultado["bonos_sector"],
            descuento_inasistencias=resultado["descuento_inasistencias"],
            total_ingresos_brutos=resultado["total_ingresos_brutos"],
            tipo_pension=resultado["tipo_pension"],
            aporte_pension=resultado["aporte_pension"],
            impuesto_renta_5ta=resultado["impuesto_renta_5ta"],
            descuento_prestamos=descuento_prestamos,
            descuentos=descuentos_totales,
            sueldo_neto=sueldo_neto_final,
            aporte_empleador_essalud=resultado["aporte_empleador_essalud"],
        ))

        total_ingresos += resultado["total_ingresos_brutos"]
        total_descuentos += descuentos_totales
        total_neto += sueldo_neto_final
        total_essalud += resultado["aporte_empleador_essalud"]

    # RF-12: actualizar cabecera de nómina con los totales consolidados
    nomina.total_ingresos = total_ingresos
    nomina.total_descuentos = total_descuentos
    nomina.total_neto = total_neto
    db.commit()

    # Fase 2: auditoría normativa sobre los detalles recién consolidados.
    alertas = auditar_prenomina(db, nomina)
    bloqueos = sum(1 for a in alertas if a["nivel"] == "bloqueo")

    return {
        "nomina_id": nomina.id,
        "periodo": nomina.periodo,
        "empleados_procesados": len(empleados),
        "total_ingresos": total_ingresos,
        "total_descuentos": total_descuentos,
        "total_neto": total_neto,
        "total_essalud_empleador": total_essalud,
        "alertas_normativas": len(alertas),
        "bloqueos_normativos": bloqueos,
    }
