import React, { useEffect, useState } from 'react';
import { colors, font } from '../theme';
import api from '../services/api';
import { Card, PageHeader, Badge, KpiCard, Loading, Empty, tableStyles, Btn, useToast, Modal, Field, Select, inputStyle, PasswordField } from '../components/ui';

// ============================================================================
// Fase 1 — Portal de aterrizaje del rol Empleado (autogestión).
//
// Vista de solo lectura de los datos propios del trabajador. El backend ya cierra
// el IDOR: /empleados/contratos/{id} solo devuelve datos si coinciden con el
// empleado autenticado. Los formularios de autogestión (vacaciones, descansos
// médicos, firma de boleta con PIN) llegan en fases posteriores.
// ============================================================================

interface Perfil {
    usuario_id: number;
    nombre: string;
    correo: string;
    rol: string;
    empresa_id: number;
    empleado_id: number | null;
    jefe_id: number | null;
}

interface Contrato {
    contrato_id: number;
    empleado_id: number;
    tipo_contrato: string;
    sueldo_base: number;
    horas_contrato_mes: number;
    fecha_inicio: string;
    fecha_fin: string | null;
    estado: string;
}

const soles = (n: number | string) =>
    'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MiEspacio() {
    const toast = useToast();
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [contratos, setContratos] = useState<Contrato[]>([]);
    const [marcaciones, setMarcaciones] = useState<any[]>([]);
    const [marcando, setMarcando] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargarMarcaciones = async (empleadoId: number) => {
        try {
            const res = await api.get('/asistencia/marcaciones', { params: { empleado_id: empleadoId } });
            setMarcaciones(Array.isArray(res.data) ? res.data : []);
        } catch { setMarcaciones([]); }
    };

    useEffect(() => {
        (async () => {
            try {
                const me = await api.get('/core/usuarios/me');
                const p: Perfil = me.data;
                setPerfil(p);
                if (p.empleado_id) {
                    const res = await api.get(`/empleados/contratos/${p.empleado_id}`);
                    setContratos(res.data);
                    cargarMarcaciones(p.empleado_id);
                }
            } catch (e: any) {
                setError(e?.response?.data?.detail || 'No se pudieron cargar tus datos.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Descarga del contrato como archivo HTML imprimible (generado en el cliente).
    const descargarContrato = (c: Contrato) => {
        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Contrato ${c.contrato_id}</title></head>
<body style="font-family:Arial,sans-serif;max-width:640px;margin:40px auto;color:#1f2430">
<h1 style="color:#EA580C;margin:0">Omnia HR</h1><p style="color:#6b7280">Constancia de contrato</p><hr>
<p><strong>Trabajador:</strong> ${perfil?.nombre || ''}</p>
<p><strong>Tipo de contrato:</strong> ${c.tipo_contrato}</p>
<p><strong>Remuneración base:</strong> ${soles(c.sueldo_base)}</p>
<p><strong>Jornada mensual:</strong> ${c.horas_contrato_mes} horas</p>
<p><strong>Inicio:</strong> ${c.fecha_inicio}</p>
<p><strong>Fin:</strong> ${c.fecha_fin || 'Indefinido'}</p>
<p><strong>Estado:</strong> ${c.estado}</p>
</body></html>`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `contrato_${c.contrato_id}.html`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    if (loading) return <Loading text="Cargando tu información…" />;
    if (error) return <div style={{ padding: 24, color: colors.red, fontFamily: font }}>{error}</div>;

    const contratoVigente = contratos.find((c) => c.estado === 'Vigente');

    return (
        <div style={{ fontFamily: font }}>
            <PageHeader
                title={`Hola, ${perfil?.nombre || 'colaborador'}`}
                subtitle="Este es tu espacio personal. Consulta tus datos, contratos y boletas."
            />

            {/* Aviso si el usuario no tiene ficha de empleado asociada */}
            {perfil && !perfil.empleado_id && (
                <Card style={{ marginBottom: 24 }}>
                    <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>
                        Tu cuenta aún no tiene un perfil de empleado vinculado. Contacta con RRHH
                        para completar tu registro.
                    </p>
                </Card>
            )}

            {/* KPIs del contrato vigente */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
                <KpiCard
                    label="Contrato vigente"
                    value={contratoVigente ? contratoVigente.tipo_contrato : '—'}
                    icon="file"
                    badge={contratoVigente ? 'Activo' : undefined}
                    badgeTone="green"
                />
                <KpiCard
                    label="Remuneración base"
                    value={contratoVigente ? soles(contratoVigente.sueldo_base) : '—'}
                    icon="dollar"
                />
                <KpiCard
                    label="Jornada mensual"
                    value={contratoVigente ? `${contratoVigente.horas_contrato_mes} h` : '—'}
                    icon="clock"
                />
            </div>

            {/* Datos personales */}
            <Card style={{ marginBottom: 28 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>
                    Mis datos
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    <Dato label="Nombre" valor={perfil?.nombre || '—'} />
                    <Dato label="Correo" valor={perfil?.correo || '—'} />
                    <Dato label="Rol" valor={perfil?.rol || '—'} />
                    <Dato label="ID de empleado" valor={perfil?.empleado_id ? `#${perfil.empleado_id}` : '—'} />
                </div>
            </Card>

            {/* Portal de autogestión (Fase 5): vacaciones, permisos, descansos médicos */}
            {perfil?.empleado_id && <AutogestionPanel />}

            {/* Mis boletas + firma con credencial (Fase 6) */}
            {perfil?.empleado_id && <BoletasPanel />}

            {/* Actualización de datos maestros (Fase 7) */}
            {perfil?.empleado_id && <DatosMaestrosPanel />}

            {/* Transparencia de asistencia: historial de solo lectura de mis marcaciones */}
            {perfil?.empleado_id && (
                <Card style={{ marginBottom: 28 }}>
                    <div style={{ marginBottom: 16 }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Mis marcaciones</h3>
                        <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>Historial de solo lectura de tus entradas y salidas registradas en el kiosco facial.</p>
                    </div>
                    {marcaciones.length === 0 ? (
                        <Empty text="Aún no tienes marcaciones registradas." />
                    ) : (
                        <table style={tableStyles.table as React.CSSProperties}>
                            <thead><tr>
                                <th style={tableStyles.th as React.CSSProperties}>Fecha y hora</th>
                                <th style={tableStyles.th as React.CSSProperties}>Tipo</th>
                                <th style={tableStyles.th as React.CSSProperties}>Origen</th>
                                <th style={tableStyles.th as React.CSSProperties}>Ubicación</th>
                            </tr></thead>
                            <tbody>
                                {marcaciones.slice(0, 12).map((m) => (
                                    <tr key={m.marcacion_id}>
                                        <td style={tableStyles.td as React.CSSProperties}>{new Date(m.momento).toLocaleString('es-PE')}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>
                                            <Badge tone={m.tipo === 'entrada' ? 'green' : 'orange'}>{m.tipo}</Badge>
                                        </td>
                                        <td style={tableStyles.td as React.CSSProperties}>{m.origen}</td>
                                        <td style={{ ...(tableStyles.td as React.CSSProperties), color: colors.textMuted, fontSize: 12 }}>
                                            {m.lat != null && m.lng != null ? `${Number(m.lat).toFixed(4)}, ${Number(m.lng).toFixed(4)}` : (m.ip || '—')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            )}

            {/* Historial de contratos (solo lectura) */}
            <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>
                    Mis contratos
                </h3>
                {contratos.length === 0 ? (
                    <Empty text="Aún no tienes contratos registrados." />
                ) : (
                    <table style={tableStyles.table as React.CSSProperties}>
                        <thead>
                            <tr>
                                <th style={tableStyles.th as React.CSSProperties}>Tipo</th>
                                <th style={tableStyles.th as React.CSSProperties}>Sueldo base</th>
                                <th style={tableStyles.th as React.CSSProperties}>Inicio</th>
                                <th style={tableStyles.th as React.CSSProperties}>Fin</th>
                                <th style={tableStyles.th as React.CSSProperties}>Estado</th>
                                <th style={tableStyles.th as React.CSSProperties}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {contratos.map((c) => (
                                <tr key={c.contrato_id}>
                                    <td style={tableStyles.td as React.CSSProperties}>{c.tipo_contrato}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>{soles(c.sueldo_base)}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>{c.fecha_inicio}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>{c.fecha_fin || 'Indefinido'}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>
                                        <Badge tone={c.estado === 'Vigente' ? 'green' : 'gray'}>{c.estado}</Badge>
                                    </td>
                                    <td style={tableStyles.td as React.CSSProperties}>
                                        <Btn size="sm" variant="outline" icon="download" onClick={() => descargarContrato(c)}>Descargar</Btn>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
}

function Dato({ label, valor }: { label: string; valor: string }) {
    return (
        <div>
            <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: colors.textStrong }}>{valor}</p>
        </div>
    );
}

// ── Autogestión del empleado (Fase 5) ──────────────────────────────────────
interface Solicitud {
    solicitud_id: number; tipo: string; fecha_inicio: string; fecha_fin: string;
    dias: number; estado: string; motivo?: string;
}
const ESTADO_TONO: Record<string, any> = { Aprobada: 'green', Rechazada: 'red', Pendiente: 'orange' };

function AutogestionPanel() {
    const toast = useToast();
    const [saldo, setSaldo] = useState<{ dias_disponibles: number; dias_ganados: number; dias_gozados: number } | null>(null);
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [modal, setModal] = useState(false);
    const [tipo, setTipo] = useState('Vacaciones');
    const [inicio, setInicio] = useState('');
    const [fin, setFin] = useState('');
    const [conGoce, setConGoce] = useState('si');
    const [motivo, setMotivo] = useState('');
    const [docNombre, setDocNombre] = useState<string | undefined>();
    const [docDatos, setDocDatos] = useState<string | undefined>();
    const [enviando, setEnviando] = useState(false);

    const cargar = async () => {
        try {
            const [s, sol] = await Promise.all([
                api.get('/beneficios/vacaciones/saldo'),
                api.get('/beneficios/solicitudes/mias'),
            ]);
            setSaldo(s.data);
            setSolicitudes(Array.isArray(sol.data) ? sol.data : []);
        } catch { /* silencioso */ }
    };
    useEffect(() => { cargar(); }, []);

    const onFile = (f: File | null) => {
        if (!f) { setDocNombre(undefined); setDocDatos(undefined); return; }
        if (f.size > 3 * 1024 * 1024) { toast('error', 'El archivo no debe superar 3 MB.'); return; }
        const reader = new FileReader();
        reader.onload = () => { setDocDatos(String(reader.result)); setDocNombre(f.name); };
        reader.readAsDataURL(f);
    };

    const enviar = async () => {
        if (!inicio || !fin) { toast('error', 'Indica las fechas.'); return; }
        setEnviando(true);
        try {
            await api.post('/beneficios/solicitudes', {
                tipo, fecha_inicio: inicio, fecha_fin: fin,
                con_goce: conGoce === 'si', motivo,
                documento_nombre: docNombre, documento_datos: docDatos,
            });
            toast('success', 'Solicitud enviada a tu jefe directo.');
            setModal(false); setInicio(''); setFin(''); setMotivo(''); setDocNombre(undefined); setDocDatos(undefined);
            cargar();
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo enviar la solicitud.');
        } finally { setEnviando(false); }
    };

    return (
        <Card style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Autogestión</h3>
                    <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>
                        Solicita vacaciones, permisos o reporta un descanso médico. Se enruta a tu jefe directo.
                        {saldo && <> · <strong style={{ color: colors.textStrong }}>{saldo.dias_disponibles} días</strong> de vacaciones disponibles.</>}
                    </p>
                </div>
                <Btn icon="plus" onClick={() => setModal(true)}>Nueva solicitud</Btn>
            </div>

            {solicitudes.length === 0 ? (
                <Empty text="Aún no tienes solicitudes." />
            ) : (
                <table style={tableStyles.table as React.CSSProperties}>
                    <thead><tr>
                        <th style={tableStyles.th as React.CSSProperties}>Tipo</th>
                        <th style={tableStyles.th as React.CSSProperties}>Periodo</th>
                        <th style={tableStyles.th as React.CSSProperties}>Días</th>
                        <th style={tableStyles.th as React.CSSProperties}>Estado</th>
                    </tr></thead>
                    <tbody>
                        {solicitudes.map((s) => (
                            <tr key={s.solicitud_id}>
                                <td style={tableStyles.td as React.CSSProperties}>{s.tipo.replace('_', ' ')}</td>
                                <td style={tableStyles.td as React.CSSProperties}>{s.fecha_inicio} → {s.fecha_fin}</td>
                                <td style={tableStyles.td as React.CSSProperties}>{s.dias}</td>
                                <td style={tableStyles.td as React.CSSProperties}>
                                    <Badge tone={ESTADO_TONO[s.estado] || 'gray'}>{s.estado}</Badge>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {modal && (
                <Modal title="Nueva solicitud" onClose={() => setModal(false)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <Field label="Tipo">
                            <Select value={tipo} onChange={setTipo}>
                                <option value="Vacaciones">Vacaciones</option>
                                <option value="Permiso">Permiso</option>
                                <option value="Licencia_medica">Descanso médico</option>
                            </Select>
                        </Field>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <Field label="Desde"><input type="date" style={inputStyle} value={inicio} onChange={(e) => setInicio(e.target.value)} /></Field>
                            <Field label="Hasta"><input type="date" style={inputStyle} value={fin} onChange={(e) => setFin(e.target.value)} /></Field>
                        </div>
                        {tipo === 'Permiso' && (
                            <Field label="¿Con goce de haber?">
                                <Select value={conGoce} onChange={setConGoce}>
                                    <option value="si">Sí (con goce)</option>
                                    <option value="no">No (sin goce)</option>
                                </Select>
                            </Field>
                        )}
                        <Field label="Motivo / detalle">
                            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                        </Field>
                        {tipo === 'Licencia_medica' && (
                            <Field label="Certificado médico (PDF/imagen, opcional)">
                                <input type="file" accept="image/*,application/pdf" onChange={(e) => onFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
                            </Field>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
                            <Btn icon="check" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar solicitud'}</Btn>
                        </div>
                    </div>
                </Modal>
            )}
        </Card>
    );
}

// ── Mis boletas + firma de conformidad (Fase 6) ────────────────────────────
interface MiBoleta {
    detalle_id: number; nomina_id: number; periodo: string; estado_nomina: string; sueldo_neto: number;
    firmada_empleado: boolean; firmada_empresa: boolean;
}

function BoletasPanel() {
    const toast = useToast();
    const [boletas, setBoletas] = useState<MiBoleta[]>([]);
    const [firmando, setFirmando] = useState<number | null>(null);
    const [password, setPassword] = useState('');
    const [enviando, setEnviando] = useState(false);

    const cargar = async () => {
        try {
            const res = await api.get('/cumplimiento/boletas/mias');
            setBoletas(Array.isArray(res.data) ? res.data : []);
        } catch { setBoletas([]); }
    };
    useEffect(() => { cargar(); }, []);

    const descargarBoleta = async (b: MiBoleta) => {
        try {
            const res = await api.get(`/nominas/${b.nomina_id}/boletas/mi-boleta`);
            const d = res.data;
            const fila = (k: string, v: any) => `<tr><td style="padding:4px 8px">${k}</td><td style="padding:4px 8px;text-align:right">${v}</td></tr>`;
            const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Boleta ${d.periodo}</title></head>
<body style="font-family:Arial,sans-serif;max-width:640px;margin:40px auto;color:#1f2430">
<h1 style="color:#EA580C;margin:0">Omnia HR</h1><p style="color:#6b7280">Boleta de pago · ${d.periodo}</p><hr>
<p><strong>${d.nombre_empleado}</strong>${d.cargo ? ' — ' + d.cargo : ''}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">
${fila('Sueldo base', soles(d.sueldo_base))}
${fila('Haberes / bonos', soles(d.haberes || 0))}
${fila('Horas extra 25%', soles(d.pago_horas_extra_25 || 0))}
${fila('Horas extra 35%', soles(d.pago_horas_extra_35 || 0))}
${fila('Horas nocturnas', soles(d.pago_horas_nocturnas || 0))}
${fila('Descuento inasistencias', '-' + soles(d.descuento_inasistencias || 0))}
${fila('Aporte pensión (' + (d.tipo_pension || '') + ')', '-' + soles(d.aporte_pension || 0))}
${fila('Impuesto 5.ª categoría', '-' + soles(d.impuesto_renta_5ta || 0))}
</table><hr>
<h2 style="text-align:right">Neto: ${soles(d.sueldo_neto)}</h2>
</body></html>`;
            const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `boleta_${d.periodo}.html`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch { toast('error', 'No se pudo descargar la boleta.'); }
    };

    const firmar = async () => {
        if (firmando == null || !password) { toast('error', 'Ingresa tu contraseña.'); return; }
        setEnviando(true);
        try {
            await api.post(`/cumplimiento/boletas/${firmando}/firmar`, { password });
            toast('success', 'Boleta firmada. Constancia de recepción registrada.');
            setFirmando(null); setPassword('');
            cargar();
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo firmar.');
        } finally { setEnviando(false); }
    };

    if (boletas.length === 0) return null;

    return (
        <Card style={{ marginBottom: 28 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Mis boletas</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted }}>
                Firma tus boletas con tu contraseña para dejar constancia legal de recepción (auditable por SUNAFIL).
            </p>
            <table style={tableStyles.table as React.CSSProperties}>
                <thead><tr>
                    <th style={tableStyles.th as React.CSSProperties}>Periodo</th>
                    <th style={tableStyles.th as React.CSSProperties}>Neto</th>
                    <th style={tableStyles.th as React.CSSProperties}>Empresa</th>
                    <th style={tableStyles.th as React.CSSProperties}>Mi firma</th>
                    <th style={tableStyles.th as React.CSSProperties}></th>
                </tr></thead>
                <tbody>
                    {boletas.map((b) => (
                        <tr key={b.detalle_id}>
                            <td style={tableStyles.td as React.CSSProperties}>{b.periodo}</td>
                            <td style={{ ...(tableStyles.td as React.CSSProperties), fontWeight: 700, color: colors.textStrong }}>{soles(b.sueldo_neto)}</td>
                            <td style={tableStyles.td as React.CSSProperties}>
                                <Badge tone={b.firmada_empresa ? 'green' : 'gray'}>{b.firmada_empresa ? 'Firmada' : 'Pendiente'}</Badge>
                            </td>
                            <td style={tableStyles.td as React.CSSProperties}>
                                <Badge tone={b.firmada_empleado ? 'green' : 'orange'}>{b.firmada_empleado ? 'Firmada' : 'Sin firmar'}</Badge>
                            </td>
                            <td style={tableStyles.td as React.CSSProperties}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Btn size="sm" variant="outline" icon="download" onClick={() => descargarBoleta(b)}>Descargar</Btn>
                                    {!b.firmada_empleado && <Btn size="sm" icon="check" onClick={() => { setFirmando(b.detalle_id); setPassword(''); }}>Firmar</Btn>}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {firmando != null && (
                <Modal title="Firmar boleta" onClose={() => setFirmando(null)}>
                    <p style={{ margin: '0 0 14px', fontSize: 14, color: colors.textBody }}>
                        Reconfirma tu identidad con tu contraseña. Esto equivale a tu firma de recepción.
                    </p>
                    <Field label="Contraseña">
                        <PasswordField value={password} onChange={setPassword} placeholder="Tu contraseña" autoComplete="current-password" />
                    </Field>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                        <Btn variant="ghost" onClick={() => setFirmando(null)}>Cancelar</Btn>
                        <Btn icon="check" disabled={enviando} onClick={firmar}>{enviando ? 'Firmando…' : 'Confirmar firma'}</Btn>
                    </div>
                </Modal>
            )}
        </Card>
    );
}

// ── Datos maestros del empleado (Fase 7) ───────────────────────────────────
interface DerHab { derechohabiente_id: number; nombre: string; parentesco: string; numero_documento?: string; estado: string; }
interface SolDato { solicitud_id: number; tipo_cambio: string; estado: string; payload: any; }

function DatosMaestrosPanel() {
    const toast = useToast();
    const [datos, setDatos] = useState<any>(null);
    const [derhab, setDerhab] = useState<DerHab[]>([]);
    const [sols, setSols] = useState<SolDato[]>([]);
    const [modal, setModal] = useState<null | 'Bancario' | 'Domicilio' | 'Derechohabiente'>(null);
    const [form, setForm] = useState<any>({});

    const cargar = async () => {
        try {
            const [d, h, s] = await Promise.all([
                api.get('/saas/mis-datos'),
                api.get('/saas/derechohabientes/mios'),
                api.get('/saas/solicitudes-datos/mias'),
            ]);
            setDatos(d.data); setDerhab(Array.isArray(h.data) ? h.data : []); setSols(Array.isArray(s.data) ? s.data : []);
        } catch { /* silencioso */ }
    };
    useEffect(() => { cargar(); }, []);

    const abrir = (tipo: 'Bancario' | 'Domicilio' | 'Derechohabiente') => {
        setForm(tipo === 'Bancario' ? { banco: datos?.banco || '', cuenta_bancaria: datos?.cuenta_bancaria || '', cci: datos?.cci || '' }
            : tipo === 'Domicilio' ? { direccion: datos?.direccion || '' }
                : { accion: 'alta', parentesco: 'Hijo', nombre: '', numero_documento: '', fecha_nacimiento: '' });
        setModal(tipo);
    };

    const enviar = async () => {
        if (!modal) return;
        try {
            await api.post('/saas/solicitudes-datos', { tipo_cambio: modal, payload: form });
            toast('success', 'Solicitud enviada a RRHH.');
            setModal(null);
            cargar();
        } catch (e: any) { toast('error', e?.response?.data?.detail || 'No se pudo enviar.'); }
    };

    const bajaDerhab = async (id: number) => {
        try {
            await api.post('/saas/solicitudes-datos', { tipo_cambio: 'Derechohabiente', payload: { accion: 'baja', derechohabiente_id: id } });
            toast('success', 'Baja solicitada a RRHH.');
            cargar();
        } catch { toast('error', 'No se pudo solicitar la baja.'); }
    };

    const pendientes = sols.filter((s) => s.estado === 'Pendiente');

    return (
        <Card style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Mis datos maestros</h3>
                    <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>Solicita a RRHH actualizar tu cuenta bancaria, domicilio o derechohabientes.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn size="sm" variant="outline" icon="edit" onClick={() => abrir('Bancario')}>Cuenta bancaria</Btn>
                    <Btn size="sm" variant="outline" icon="edit" onClick={() => abrir('Domicilio')}>Domicilio</Btn>
                    <Btn size="sm" variant="outline" icon="plus" onClick={() => abrir('Derechohabiente')}>Derechohabiente</Btn>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: derhab.length || pendientes.length ? 20 : 0 }}>
                <Dato label="Documento" valor={datos?.numero_documento ? `${datos.tipo_documento || 'DNI'} ${datos.numero_documento}` : '—'} />
                <Dato label="Banco / cuenta" valor={datos?.cuenta_bancaria ? `${datos.banco || ''} ${datos.cuenta_bancaria}` : '—'} />
                <Dato label="CCI" valor={datos?.cci || '—'} />
                <Dato label="Domicilio" valor={datos?.direccion || '—'} />
            </div>

            {derhab.length > 0 && (
                <div style={{ marginBottom: pendientes.length ? 20 : 0 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: colors.textBody }}>Derechohabientes</p>
                    {derhab.map((d) => (
                        <div key={d.derechohabiente_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${colors.borderSoft}` }}>
                            <span style={{ fontSize: 14 }}>{d.nombre} <Badge tone="blue">{d.parentesco}</Badge></span>
                            <Btn size="sm" variant="danger" onClick={() => bajaDerhab(d.derechohabiente_id)}>Dar de baja</Btn>
                        </div>
                    ))}
                </div>
            )}

            {pendientes.length > 0 && (
                <p style={{ margin: 0, fontSize: 12.5, color: colors.textMuted }}>
                    Tienes {pendientes.length} solicitud(es) de cambio pendiente(s) de aprobación por RRHH.
                </p>
            )}

            {modal && (
                <Modal title={`Solicitar cambio · ${modal}`} onClose={() => setModal(null)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {modal === 'Bancario' && (<>
                            <Field label="Banco"><input style={inputStyle} value={form.banco || ''} onChange={(e) => setForm({ ...form, banco: e.target.value })} /></Field>
                            <Field label="N.º de cuenta"><input style={inputStyle} value={form.cuenta_bancaria || ''} onChange={(e) => setForm({ ...form, cuenta_bancaria: e.target.value })} /></Field>
                            <Field label="CCI"><input style={inputStyle} value={form.cci || ''} onChange={(e) => setForm({ ...form, cci: e.target.value })} /></Field>
                        </>)}
                        {modal === 'Domicilio' && (
                            <Field label="Nuevo domicilio"><input style={inputStyle} value={form.direccion || ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></Field>
                        )}
                        {modal === 'Derechohabiente' && (<>
                            <Field label="Nombre completo"><input style={inputStyle} value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
                            <Field label="Parentesco">
                                <Select value={form.parentesco || 'Hijo'} onChange={(v) => setForm({ ...form, parentesco: v })}>
                                    <option value="Hijo">Hijo(a)</option>
                                    <option value="Conyuge">Cónyuge</option>
                                </Select>
                            </Field>
                            <Field label="N.º de documento"><input style={inputStyle} value={form.numero_documento || ''} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} /></Field>
                            <Field label="Fecha de nacimiento"><input type="date" style={inputStyle} value={form.fecha_nacimiento || ''} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} /></Field>
                        </>)}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                            <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
                            <Btn icon="check" onClick={enviar}>Enviar a RRHH</Btn>
                        </div>
                    </div>
                </Modal>
            )}
        </Card>
    );
}
