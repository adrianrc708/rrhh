import React, { useEffect, useState } from 'react';
import { colors, font } from '../theme';
import api from '../services/api';
import {
    Card, PageHeader, Badge, Loading, Empty, tableStyles, Btn, Field, Select,
    inputStyle, useToast, Tabs,
} from '../components/ui';

// ============================================================================
// Fase 5 — Aprobaciones del Gerente (aislamiento por parent_id en el backend).
//   · Solicitudes de autogestión (vacaciones/permisos/licencias) del equipo.
//   · Validación de sobretiempo real antes de valorizarlo en nómina.
//   · Evaluación de desempeño y kardex disciplinario.
// ============================================================================

interface Solicitud {
    solicitud_id: number; empleado_nombre?: string; empleado_id: number; tipo: string;
    fecha_inicio: string; fecha_fin: string; dias: number; con_goce: boolean;
    motivo?: string; estado: string; documento_nombre?: string;
}
interface Sobretiempo {
    id: number; empleado_id: number; empleado_nombre?: string; periodo: string;
    horas_extra_25: number; horas_extra_35: number; horas_nocturnas: number; estado_aprobacion?: string;
}
interface Empleado { empleado_id: number; nombre?: string; }
interface Evaluacion { evaluacion_id: number; tipo: string; periodo?: string; puntaje?: number; comentario: string; fecha_creacion?: string; }
interface CambioDatos { solicitud_id: number; empleado_nombre?: string; tipo_cambio: string; payload: any; estado: string; }

const TIPO_TONO: Record<string, any> = { Vacaciones: 'blue', Permiso: 'orange', Licencia_medica: 'gray' };

export default function Aprobaciones({ userRol }: { userRol: string }) {
    const esRRHH = userRol === 'RRHH' || userRol === 'Admin';
    const toast = useToast();
    const [tab, setTab] = useState('Solicitudes');
    const [loading, setLoading] = useState(true);
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [sobretiempo, setSobretiempo] = useState<Sobretiempo[]>([]);
    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [datosMaestros, setDatosMaestros] = useState<CambioDatos[]>([]);

    // Evaluación
    const [evalEmp, setEvalEmp] = useState('');
    const [evalTipo, setEvalTipo] = useState('Evaluacion');
    const [evalPuntaje, setEvalPuntaje] = useState('3');
    const [evalComentario, setEvalComentario] = useState('');
    const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);

    const cargar = async () => {
        try {
            const reqs = [
                api.get('/beneficios/solicitudes/pendientes'),
                api.get('/beneficios/sobretiempo/pendientes'),
                api.get('/empleados/'),
            ];
            if (esRRHH) reqs.push(api.get('/saas/solicitudes-datos').catch(() => ({ data: [] })));
            const [s, h, e, d] = await Promise.all(reqs);
            setSolicitudes(Array.isArray(s.data) ? s.data : []);
            setSobretiempo(Array.isArray(h.data) ? h.data : []);
            setEmpleados(Array.isArray(e.data) ? e.data : []);
            if (esRRHH) setDatosMaestros(Array.isArray(d?.data) ? d.data : []);
        } catch {
            toast('error', 'No se pudieron cargar las aprobaciones.');
        } finally { setLoading(false); }
    };

    const resolverDatos = async (id: number, aprobar: boolean) => {
        try {
            await api.patch(`/saas/solicitudes-datos/${id}/resolver`, { aprobar });
            toast('success', aprobar ? 'Cambio aplicado.' : 'Solicitud rechazada.');
            cargar();
        } catch (e: any) { toast('error', e?.response?.data?.detail || 'No se pudo resolver.'); }
    };

    useEffect(() => { cargar(); }, []);

    const resolver = async (id: number, aprobar: boolean) => {
        try {
            await api.patch(`/beneficios/solicitudes/${id}/resolver`, { aprobar });
            toast('success', aprobar ? 'Solicitud aprobada.' : 'Solicitud rechazada.');
            cargar();
        } catch (e: any) { toast('error', e?.response?.data?.detail || 'No se pudo resolver.'); }
    };

    const resolverST = async (id: number, aprobar: boolean) => {
        try {
            await api.patch(`/beneficios/sobretiempo/${id}/resolver`, { aprobar });
            toast('success', aprobar ? 'Sobretiempo aprobado.' : 'Sobretiempo rechazado.');
            cargar();
        } catch (e: any) { toast('error', e?.response?.data?.detail || 'No se pudo resolver.'); }
    };

    const verEvaluaciones = async (empId: string) => {
        setEvalEmp(empId);
        if (!empId) { setEvaluaciones([]); return; }
        try {
            const res = await api.get(`/beneficios/evaluaciones/${empId}`);
            setEvaluaciones(Array.isArray(res.data) ? res.data : []);
        } catch { setEvaluaciones([]); }
    };

    const crearEvaluacion = async () => {
        if (!evalEmp || !evalComentario.trim()) { toast('error', 'Selecciona empleado y escribe un comentario.'); return; }
        try {
            await api.post('/beneficios/evaluaciones', {
                empleado_id: Number(evalEmp), tipo: evalTipo,
                puntaje: evalTipo === 'Evaluacion' ? Number(evalPuntaje) : null,
                comentario: evalComentario,
            });
            toast('success', 'Asiento registrado.');
            setEvalComentario('');
            verEvaluaciones(evalEmp);
        } catch (e: any) { toast('error', e?.response?.data?.detail || 'No se pudo registrar.'); }
    };

    if (loading) return <Loading text="Cargando aprobaciones…" />;

    return (
        <div style={{ fontFamily: font }}>
            <PageHeader
                title="Aprobaciones de mi equipo"
                subtitle="Resuelve solicitudes, valida el sobretiempo real y evalúa el desempeño de tus subordinados directos."
            />

            <TabsAprobacion
                tab={tab} setTab={setTab}
                defs={[
                    { key: 'Solicitudes', label: `Solicitudes (${solicitudes.length})` },
                    { key: 'Sobretiempo', label: `Sobretiempo (${sobretiempo.length})` },
                    { key: 'Desempeño', label: 'Desempeño' },
                    ...(esRRHH ? [{ key: 'Datos', label: `Datos maestros (${datosMaestros.length})` }] : []),
                ]}
            />

            {tab === 'Solicitudes' && (
                <Card>
                    {solicitudes.length === 0 ? <Empty text="No hay solicitudes pendientes." /> : (
                        <table style={tableStyles.table as React.CSSProperties}>
                            <thead><tr>
                                <th style={tableStyles.th as React.CSSProperties}>Empleado</th>
                                <th style={tableStyles.th as React.CSSProperties}>Tipo</th>
                                <th style={tableStyles.th as React.CSSProperties}>Periodo</th>
                                <th style={tableStyles.th as React.CSSProperties}>Días</th>
                                <th style={tableStyles.th as React.CSSProperties}>Motivo</th>
                                <th style={tableStyles.th as React.CSSProperties}></th>
                            </tr></thead>
                            <tbody>
                                {solicitudes.map((s) => (
                                    <tr key={s.solicitud_id}>
                                        <td style={tableStyles.td as React.CSSProperties}>{s.empleado_nombre || `#${s.empleado_id}`}</td>
                                        <td style={tableStyles.td as React.CSSProperties}><Badge tone={TIPO_TONO[s.tipo] || 'gray'}>{s.tipo.replace('_', ' ')}</Badge></td>
                                        <td style={tableStyles.td as React.CSSProperties}>{s.fecha_inicio} → {s.fecha_fin}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>{s.dias}</td>
                                        <td style={{ ...(tableStyles.td as React.CSSProperties), color: colors.textMuted, fontSize: 13 }}>
                                            {s.motivo || '—'}{s.documento_nombre ? ` · 📎 ${s.documento_nombre}` : ''}
                                        </td>
                                        <td style={tableStyles.td as React.CSSProperties}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <Btn size="sm" variant="green" onClick={() => resolver(s.solicitud_id, true)}>Aprobar</Btn>
                                                <Btn size="sm" variant="danger" onClick={() => resolver(s.solicitud_id, false)}>Rechazar</Btn>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            )}

            {tab === 'Sobretiempo' && (
                <Card>
                    {sobretiempo.length === 0 ? <Empty text="No hay sobretiempo por validar." /> : (
                        <table style={tableStyles.table as React.CSSProperties}>
                            <thead><tr>
                                <th style={tableStyles.th as React.CSSProperties}>Empleado</th>
                                <th style={tableStyles.th as React.CSSProperties}>Periodo</th>
                                <th style={tableStyles.th as React.CSSProperties}>Extra 25%</th>
                                <th style={tableStyles.th as React.CSSProperties}>Extra 35%</th>
                                <th style={tableStyles.th as React.CSSProperties}>Nocturnas</th>
                                <th style={tableStyles.th as React.CSSProperties}>Estado</th>
                                <th style={tableStyles.th as React.CSSProperties}></th>
                            </tr></thead>
                            <tbody>
                                {sobretiempo.map((h) => (
                                    <tr key={h.id}>
                                        <td style={tableStyles.td as React.CSSProperties}>{h.empleado_nombre || `#${h.empleado_id}`}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>{h.periodo}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>{Number(h.horas_extra_25)} h</td>
                                        <td style={tableStyles.td as React.CSSProperties}>{Number(h.horas_extra_35)} h</td>
                                        <td style={tableStyles.td as React.CSSProperties}>{Number(h.horas_nocturnas)} h</td>
                                        <td style={tableStyles.td as React.CSSProperties}>
                                            <Badge tone={h.estado_aprobacion === 'Aprobado' ? 'green' : h.estado_aprobacion === 'Rechazado' ? 'red' : 'orange'}>
                                                {h.estado_aprobacion || 'Pendiente'}
                                            </Badge>
                                        </td>
                                        <td style={tableStyles.td as React.CSSProperties}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <Btn size="sm" variant="green" onClick={() => resolverST(h.id, true)}>Aprobar</Btn>
                                                <Btn size="sm" variant="danger" onClick={() => resolverST(h.id, false)}>Rechazar</Btn>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            )}

            {tab === 'Desempeño' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 20, alignItems: 'start' }}>
                    <Card>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Nuevo asiento</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <Field label="Empleado">
                                <Select value={evalEmp} onChange={verEvaluaciones}>
                                    <option value="">Selecciona…</option>
                                    {empleados.map((e) => <option key={e.empleado_id} value={e.empleado_id}>{e.nombre || `#${e.empleado_id}`}</option>)}
                                </Select>
                            </Field>
                            <Field label="Tipo">
                                <Select value={evalTipo} onChange={setEvalTipo}>
                                    <option value="Evaluacion">Evaluación (con puntaje)</option>
                                    <option value="Kardex_positivo">Kardex positivo</option>
                                    <option value="Kardex_disciplinario">Kardex disciplinario</option>
                                </Select>
                            </Field>
                            {evalTipo === 'Evaluacion' && (
                                <Field label="Puntaje (1–5)">
                                    <Select value={evalPuntaje} onChange={setEvalPuntaje}>
                                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                                    </Select>
                                </Field>
                            )}
                            <Field label="Comentario">
                                <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={evalComentario} onChange={(e) => setEvalComentario(e.target.value)} />
                            </Field>
                            <Btn icon="check" onClick={crearEvaluacion}>Registrar</Btn>
                        </div>
                    </Card>
                    <Card>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Historial (kardex)</h3>
                        {!evalEmp ? <Empty text="Selecciona un empleado para ver su historial." />
                            : evaluaciones.length === 0 ? <Empty text="Sin asientos registrados." />
                                : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {evaluaciones.map((ev) => (
                                            <div key={ev.evaluacion_id} style={{ padding: 14, border: `1px solid ${colors.borderSoft}`, borderRadius: 10 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <Badge tone={ev.tipo === 'Kardex_disciplinario' ? 'red' : ev.tipo === 'Kardex_positivo' ? 'green' : 'blue'}>
                                                        {ev.tipo.replace('_', ' ')}{ev.puntaje ? ` · ${ev.puntaje}/5` : ''}
                                                    </Badge>
                                                    <span style={{ fontSize: 12, color: colors.textFaint }}>{ev.fecha_creacion ? new Date(ev.fecha_creacion).toLocaleDateString('es-PE') : ''}</span>
                                                </div>
                                                <p style={{ margin: 0, fontSize: 14, color: colors.textBody }}>{ev.comentario}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                    </Card>
                </div>
            )}

            {tab === 'Datos' && esRRHH && (
                <Card>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted }}>
                        Solicitudes de los trabajadores para actualizar cuenta bancaria, domicilio o derechohabientes.
                    </p>
                    {datosMaestros.length === 0 ? <Empty text="No hay solicitudes de cambio de datos pendientes." /> : (
                        <table style={tableStyles.table as React.CSSProperties}>
                            <thead><tr>
                                <th style={tableStyles.th as React.CSSProperties}>Empleado</th>
                                <th style={tableStyles.th as React.CSSProperties}>Tipo</th>
                                <th style={tableStyles.th as React.CSSProperties}>Detalle</th>
                                <th style={tableStyles.th as React.CSSProperties}></th>
                            </tr></thead>
                            <tbody>
                                {datosMaestros.map((s) => (
                                    <tr key={s.solicitud_id}>
                                        <td style={tableStyles.td as React.CSSProperties}>{s.empleado_nombre}</td>
                                        <td style={tableStyles.td as React.CSSProperties}><Badge tone="blue">{s.tipo_cambio}</Badge></td>
                                        <td style={{ ...(tableStyles.td as React.CSSProperties), fontSize: 12.5, color: colors.textMuted, maxWidth: 340 }}>
                                            {Object.entries(s.payload || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                        </td>
                                        <td style={tableStyles.td as React.CSSProperties}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <Btn size="sm" variant="green" onClick={() => resolverDatos(s.solicitud_id, true)}>Aprobar</Btn>
                                                <Btn size="sm" variant="danger" onClick={() => resolverDatos(s.solicitud_id, false)}>Rechazar</Btn>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            )}
        </div>
    );
}

// Pestañas con clave/etiqueta desacopladas (evita perder el estado al cambiar los contadores).
function TabsAprobacion({ tab, setTab, defs }: { tab: string; setTab: (k: string) => void; defs: { key: string; label: string }[] }) {
    const activa = defs.find((d) => d.key === tab) || defs[0];
    return (
        <Tabs
            tabs={defs.map((d) => d.label)}
            active={activa.label}
            onChange={(label) => { const d = defs.find((x) => x.label === label); if (d) setTab(d.key); }}
        />
    );
}
