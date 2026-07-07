"""
Fase 6 — Generadores de archivos planos para declaraciones legales (Perú).

Producen texto plano/CSV a partir de una nómina consolidada. Los formatos son una
representación estructurada y trazable de lo que exigen los portales (SUNAT PLAME,
T-Registro, AFPnet) y los bancos; están documentados para que RRHH los mapee al
layout oficial vigente. No requieren tablas nuevas.
"""
from __future__ import annotations

from decimal import Decimal
from typing import List, Tuple

from sqlalchemy.orm import Session

from src.core.models import DetalleNomina, Nomina, Usuario, Empresa
from src.hr.models import Empleado, Contrato


def _num(v) -> str:
    return f"{Decimal(str(v or 0)):.2f}"


def _detalles(db: Session, nomina: Nomina) -> List[Tuple[DetalleNomina, Empleado, Usuario]]:
    filas = []
    detalles = db.query(DetalleNomina).filter(
        DetalleNomina.nomina_id == nomina.id,
        DetalleNomina.is_deleted.is_(False),
    ).all()
    for d in detalles:
        u = db.query(Usuario).filter(Usuario.usuario_id == d.usuario_id).first()
        emp = db.query(Empleado).filter(Empleado.usuario_id == d.usuario_id).first()
        filas.append((d, emp, u))
    return filas


def _empresa(db: Session, nomina: Nomina) -> Empresa:
    return db.query(Empresa).filter(Empresa.empresa_id == nomina.empresa_id).first()


# ==========================================================================
# PLAME — Planilla Mensual de Pagos (SUNAT)
# ==========================================================================

def generar_plame(db: Session, nomina: Nomina) -> str:
    emp = _empresa(db, nomina)
    ruc = emp.ruc if emp else ""
    lineas = [
        "# PLAME - PLANILLA MENSUAL DE PAGOS",
        f"# RUC|{ruc}|PERIODO|{nomina.periodo}",
        "TIPODOC|NRODOC|APELLIDOSYNOMBRES|DIAS_LAB|REMUN|APORTE_PENSION|RENTA_5TA|ESSALUD_EMPLEADOR",
    ]
    for d, e, u in _detalles(db, nomina):
        nombre = (e.nombre if e and e.nombre else (u.nombre if u else "")).upper()
        tipo_doc = (e.tipo_documento if e and e.tipo_documento else "DNI")
        nro_doc = (e.numero_documento if e and e.numero_documento else "")
        dias = int(float(d.horas_trabajadas or 0) / 8) if d.horas_trabajadas else 30
        lineas.append("|".join([
            tipo_doc, nro_doc, nombre, str(dias),
            _num(d.total_ingresos_brutos or d.sueldo_base),
            _num(d.aporte_pension), _num(d.impuesto_renta_5ta),
            _num(d.aporte_empleador_essalud),
        ]))
    return "\n".join(lineas) + "\n"


# ==========================================================================
# T-Registro — Registro de trabajadores (SUNAT)
# ==========================================================================

def generar_tregistro(db: Session, nomina: Nomina) -> str:
    emp = _empresa(db, nomina)
    ruc = emp.ruc if emp else ""
    regimen = emp.regimen_laboral if emp else "General"
    lineas = [
        "# T-REGISTRO - REGISTRO DE TRABAJADORES",
        f"# RUC|{ruc}|REGIMEN|{regimen}",
        "TIPODOC|NRODOC|APELLIDOSYNOMBRES|FECHA_INGRESO|TIPO_CONTRATO|SITUACION",
    ]
    for d, e, u in _detalles(db, nomina):
        if not e:
            continue
        nombre = (e.nombre if e.nombre else (u.nombre if u else "")).upper()
        contrato = db.query(Contrato).filter(
            Contrato.empleado_id == e.empleado_id, Contrato.is_deleted.is_(False),
        ).order_by(Contrato.fecha_inicio.desc()).first()
        tipo_c = contrato.tipo_contrato if contrato else "Indeterminado"
        ingreso = e.fecha_ingreso.isoformat() if e.fecha_ingreso else ""
        situacion = "ACTIVO" if e.estado == "Activo" else "BAJA"
        lineas.append("|".join([
            e.tipo_documento or "DNI", e.numero_documento or "",
            nombre, ingreso, tipo_c, situacion,
        ]))
    return "\n".join(lineas) + "\n"


# ==========================================================================
# AFPnet — Declaración de aportes al SPP (CSV)
# ==========================================================================

def generar_afpnet(db: Session, nomina: Nomina) -> str:
    lineas = [
        "CUSPP,TIPODOC,NRODOC,APELLIDOSYNOMBRES,REMUN_ASEGURABLE,APORTE_OBLIGATORIO,PRIMA_SEGURO,COMISION",
    ]
    for d, e, u in _detalles(db, nomina):
        if (d.tipo_pension or "").upper() != "AFP":
            continue  # AFPnet solo declara afiliados al SPP
        nombre = (e.nombre if e and e.nombre else (u.nombre if u else "")).replace(",", " ")
        remun = Decimal(str(d.total_ingresos_brutos or d.sueldo_base or 0))
        # El aporte total (10% + prima + comisión) ya está en aporte_pension; se
        # reparte de forma referencial: 10% aporte obligatorio, el resto seguro/comisión.
        aporte_obl = (remun * Decimal("0.10")).quantize(Decimal("0.01"))
        resto = Decimal(str(d.aporte_pension or 0)) - aporte_obl
        prima = (remun * Decimal("0.0174")).quantize(Decimal("0.01"))
        comision = resto - prima if resto > prima else Decimal("0.00")
        lineas.append(",".join([
            e.cuspp if e and e.cuspp else "",
            e.tipo_documento if e and e.tipo_documento else "DNI",
            e.numero_documento if e and e.numero_documento else "",
            nombre, _num(remun), _num(aporte_obl), _num(prima), _num(comision),
        ]))
    return "\n".join(lineas) + "\n"


# ==========================================================================
# Dispersión bancaria — abono de haberes (TXT/CSV por banco)
# ==========================================================================

BANCOS = ["BCP", "BBVA", "Interbank", "Scotiabank"]


def generar_dispersion(db: Session, nomina: Nomina, banco: str) -> str:
    emp = _empresa(db, nomina)
    ruc = emp.ruc if emp else ""
    filas = _detalles(db, nomina)

    # BCP: layout tipo "telecrédito" separado por pipe; otros bancos: CSV con CCI.
    if banco == "BCP":
        lineas = [f"# BCP TELECREDITO|{ruc}|{nomina.periodo}",
                  "CUENTA|MONEDA|MONTO|NRODOC|BENEFICIARIO"]
        for d, e, u in filas:
            if not e:
                continue
            cuenta = e.cuenta_bancaria or ""
            nombre = (e.nombre if e.nombre else (u.nombre if u else "")).upper()
            lineas.append("|".join([cuenta, "PEN", _num(d.sueldo_neto),
                                    e.numero_documento or "", nombre]))
        return "\n".join(lineas) + "\n"

    lineas = [f"# {banco.upper()} - ABONO DE HABERES,{ruc},{nomina.periodo}",
              "CCI,CUENTA,NRODOC,BENEFICIARIO,MONEDA,MONTO"]
    for d, e, u in filas:
        if not e:
            continue
        nombre = (e.nombre if e.nombre else (u.nombre if u else "")).replace(",", " ").upper()
        lineas.append(",".join([e.cci or "", e.cuenta_bancaria or "",
                                e.numero_documento or "", nombre, "PEN", _num(d.sueldo_neto)]))
    return "\n".join(lineas) + "\n"
