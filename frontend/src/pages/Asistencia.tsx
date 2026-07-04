import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors, radius, font } from '../theme';
import Icon from '../components/Icons';
import { Card, PageHeader, Tabs, KpiCard, Badge, Btn, Loading, Empty, Progress, tableStyles, inputStyle, Field, Select, downloadCSV, useToast } from '../components/ui';
import TurnosTab from '../components/TurnosTab';
import PermisosTab from '../components/PermisosTab';
import AIPanelTab from '../components/AIPanelTab';

const TIPOS = ['Injustificada', 'Justificada', 'Permiso_sin_goce', 'Permiso_con_goce', 'Licencia'];
const TIPO_TONE: Record<string, any> = {
    Injustificada: 'red', Justificada: 'blue', Permiso_sin_goce: 'amber', Permiso_con_goce: 'green', Licencia: 'purple',
};

function ModalInasistencia({ empleados, onClose, onSaved }: { empleados: any[]; onClose: () => void; onSaved: () => void }) {
    const toast = useToast();
    const [empleadoId, setEmpleadoId] = useState('');
    const [fecha, setFecha] = useState('');
    const [tipo, setTipo] = useState('Injustificada');
    const [horas, setHoras] = useState('8');
    const [obs, setObs] = useState('');
    const [guardando, setGuardando] = useState(false);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empleadoId || !fecha) { toast('warning', 'Selecciona colaborador y fecha.'); return; }
        try {
            setGuardando(true);
            await api.post('/asistencia/', {
                empleado_id: Number(empleadoId), fecha, tipo,
                horas_ausentes: Number(horas), observaciones: obs || null,
            });
            onSaved(); onClose();
        } catch (err) {
            console.error('Error al registrar inasistencia:', err);
            toast('error', 'No se pudo registrar la inasistencia.');
        } finally { setGuardando(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,19,40,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: radius.lg, padding: 28, width: 460, fontFamily: font, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700, color: colors.textStrong }}>Registrar Inasistencia</h3>
                <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Field label="Colaborador">
                        <Select value={empleadoId} onChange={setEmpleadoId} required>
                            <option value="">— Seleccionar —</option>
                            {empleados.map((e) => <option key={e.empleado_id} value={e.empleado_id}>{e.nombre || `ID ${e.empleado_id}`}</option>)}
                        </Select>
                    </Field>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} required /></Field>
                        <Field label="Horas ausentes"><input type="number" min="0" max="24" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} style={inputStyle} /></Field>
                    </div>
                    <Field label="Tipo de inasistencia">
                        <Select value={tipo} onChange={setTipo}>
                            {TIPOS.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                        </Select>
                    </Field>
                    <div style={{ fontSize: 12, color: colors.textMuted, marginTop: -4 }}>
                        {(tipo === 'Injustificada' || tipo === 'Permiso_sin_goce')
                            ? <span style={{ color: colors.orangeText }}>⚠ Este tipo genera descuento automático en nómina.</span>
                            : <span style={{ color: colors.greenText }}>✓ Este tipo no descuenta sueldo.</span>}
                    </div>
                    <Field label="Observaciones (opcional)">
                        <textarea value={obs} onChange={(e) => setObs(e.target.value)} style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} />
                    </Field>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                        <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
                        <Btn type="submit" variant="orange" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar'}</Btn>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Asistencia() {
    const toast = useToast();
    const [tab, setTab] = useState('Registro de Inasistencias');
    const [empleados, setEmpleados] = useState<any[]>([]);
    const [empleadoSel, setEmpleadoSel] = useState('');
    const [inasistencias, setInasistencias] = useState<any[]>([]);
    const [cargando, setCargando] = useState(false);
    const [modal, setModal] = useState(false);
    const [analitica, setAnalitica] = useState<any | null>(null);
    const [analiticaLoading, setAnaliticaLoading] = useState(false);
    const [chatSessions, setChatSessions] = useState<Record<string, {role: string, content: string}[]>>({});

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/empleados/');
                setEmpleados(Array.isArray(res.data) ? res.data : []);
            } catch (e) { console.error(e); }
        })();
    }, []);

    const cargarInasistencias = async (id: string) => {
        if (!id) { setInasistencias([]); return; }
        try {
            setCargando(true);
            const res = await api.get(`/asistencia/empleado/${id}`);
            setInasistencias(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error('Error al cargar inasistencias:', e);
            setInasistencias([]);
        } finally { setCargando(false); }
    };

    useEffect(() => { 
        cargarInasistencias(empleadoSel); 
    }, [empleadoSel]);

    // Analítica: agrega las inasistencias de todos los colaboradores
    const cargarAnalitica = async () => {
        if (!empleados.length) { setAnalitica({ total: 0, porTipo: {}, conDescuento: 0, horas: 0, ranking: [] }); return; }
        try {
            setAnaliticaLoading(true);
            const results = await Promise.all(empleados.map((e) =>
                api.get(`/asistencia/empleado/${e.empleado_id}`)
                    .then((r) => ({ e, data: Array.isArray(r.data) ? r.data : [] }))
                    .catch(() => ({ e, data: [] }))
            ));
            const porTipo: Record<string, number> = {};
            let total = 0, conDescuento = 0, horas = 0;
            const ranking: any[] = [];
            for (const { e, data } of results) {
                total += data.length;
                for (const i of data) {
                    porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1;
                    if (i.descuenta_sueldo) { conDescuento++; horas += Number(i.horas_ausentes); }
                }
                if (data.length > 0) ranking.push({ nombre: e.nombre || `ID ${e.empleado_id}`, count: data.length });
            }
            ranking.sort((a, b) => b.count - a.count);
            setAnalitica({ total, porTipo, conDescuento, horas, ranking });
        } finally { setAnaliticaLoading(false); }
    };

    useEffect(() => {
        if (tab === 'Analítica de Inasistencias' && !analitica) cargarAnalitica();
    }, [tab, empleados]); // eslint-disable-line

    const refrescar = () => { cargarInasistencias(empleadoSel); setAnalitica(null); };

    const eliminar = async (id: number) => {
        if (!window.confirm('¿Eliminar este registro de inasistencia?')) return;
        try { await api.delete(`/asistencia/${id}`); refrescar(); toast('success', 'Registro eliminado correctamente.'); }
        catch (e) { console.error(e); toast('error', 'No se pudo eliminar el registro.'); }
    };

    const syncZKTeco = async () => {
        try {
            toast('info', 'Sincronizando con ZKTeco...');
            await api.post('/asistencia/sync-zkteco');
            toast('success', 'Sincronización exitosa.');
            refrescar();
        } catch (e) {
            console.error(e);
            toast('error', 'Error al sincronizar con ZKTeco.');
        }
    };

    const exportar = () => {
        if (!inasistencias.length) return;
        const nombre = empleados.find((e) => String(e.empleado_id) === empleadoSel)?.nombre || empleadoSel;
        const rows: (string | number)[][] = [
            ['Fecha', 'Tipo', 'Horas', 'Periodo', 'Descuenta', 'Observaciones'],
            ...inasistencias.map((i) => [i.fecha, i.tipo, Number(i.horas_ausentes), i.periodo, i.descuenta_sueldo ? 'Sí' : 'No', i.observaciones || '']),
        ];
        downloadCSV(`inasistencias_${nombre}.csv`, rows);
    };

    return (
        <div>
            <PageHeader
                title="Gestión de Asistencia"
                subtitle="Registro de inasistencias y permisos que alimentan los descuentos de nómina"
                action={
                    <div style={{ display: 'flex', gap: 10 }}>
                        <Btn icon="refresh" variant="outline" onClick={syncZKTeco}>Sincronizar ZKTeco</Btn>
                        <Btn icon="plus" onClick={() => setModal(true)}>Registrar Inasistencia</Btn>
                    </div>
                }
            />

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
                <KpiCard icon="users" label="Colaboradores" value={String(empleados.length)} sub="Total en planilla" badge="Activo" badgeTone="green" />
                <KpiCard icon="clock" label="Registros del Colaborador" value={empleadoSel ? String(inasistencias.length) : '—'} sub="Inasistencias cargadas" badge="Filtro" badgeTone="blue" />
                <KpiCard icon="alert" label="Con Descuento" value={empleadoSel ? String(inasistencias.filter((i) => i.descuenta_sueldo).length) : '—'} sub="Generan deducción" badge="Atención" badgeTone="amber" />
                <KpiCard icon="check" label="Sin Descuento" value={empleadoSel ? String(inasistencias.filter((i) => !i.descuenta_sueldo).length) : '—'} sub="Justificadas / con goce" badge="OK" badgeTone="green" />
            </div>

            <Tabs tabs={['Registro de Inasistencias', 'Analítica de Inasistencias', 'Gestión de Turnos', 'Permisos y Justificaciones', 'Panel de IA']} active={tab} onChange={setTab} />

            {tab === 'Registro de Inasistencias' && (
                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Inasistencias por Colaborador</h3>
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textMuted }}>Selecciona un colaborador para ver y gestionar sus registros.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            {empleadoSel && inasistencias.length > 0 && <Btn size="sm" variant="indigo" icon="download" onClick={exportar}>Exportar CSV</Btn>}
                            <Select value={empleadoSel} onChange={setEmpleadoSel} style={{ width: 240 }}>
                                <option value="">— Seleccionar colaborador —</option>
                                {empleados.map((e) => <option key={e.empleado_id} value={e.empleado_id}>{e.nombre || `ID ${e.empleado_id}`}</option>)}
                            </Select>
                        </div>
                    </div>

                    {!empleadoSel ? <Empty text="Selecciona un colaborador para ver sus inasistencias." />
                        : cargando ? <Loading />
                            : inasistencias.length === 0 ? <Empty text="Este colaborador no tiene inasistencias registradas." />
                                : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={tableStyles.table}>
                                            <thead>
                                                <tr>
                                                    <th style={tableStyles.th}>Fecha</th>
                                                    <th style={tableStyles.th}>Tipo</th>
                                                    <th style={tableStyles.th}>Horas</th>
                                                    <th style={tableStyles.th}>Periodo</th>
                                                    <th style={tableStyles.th}>Efecto</th>
                                                    <th style={tableStyles.th}>Observaciones</th>
                                                    <th style={{ ...tableStyles.th, textAlign: 'center' }}>Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {inasistencias.map((i) => (
                                                    <tr key={i.inasistencia_id}>
                                                        <td style={{ ...tableStyles.td, fontWeight: 600, color: colors.textStrong }}>{i.fecha}</td>
                                                        <td style={tableStyles.td}><Badge tone={TIPO_TONE[i.tipo] || 'gray'}>{i.tipo.replace(/_/g, ' ')}</Badge></td>
                                                        <td style={tableStyles.td}>{Number(i.horas_ausentes)} h</td>
                                                        <td style={{ ...tableStyles.td, color: colors.textMuted }}>{i.periodo}</td>
                                                        <td style={tableStyles.td}>
                                                            {i.descuenta_sueldo ? <Badge tone="orange">Descuenta</Badge> : <Badge tone="green">Sin descuento</Badge>}
                                                        </td>
                                                        <td style={{ ...tableStyles.td, color: colors.textMuted, maxWidth: 220 }}>{i.observaciones || '—'}</td>
                                                        <td style={{ ...tableStyles.td, textAlign: 'center' }}>
                                                            <Btn size="sm" variant="danger" icon="trash" onClick={() => eliminar(i.inasistencia_id)}>Eliminar</Btn>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                </Card>
            )}

            {tab === 'Analítica de Inasistencias' && (
                analiticaLoading || !analitica ? <Card><Loading text="Agregando inasistencias de todos los colaboradores…" /></Card> : (
                    <>
                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
                            <KpiCard icon="clock" label="Total Inasistencias" value={String(analitica.total)} sub="Todos los colaboradores" badge="Global" badgeTone="blue" />
                            <KpiCard icon="alert" label="Con Descuento" value={String(analitica.conDescuento)} sub="Generan deducción" badge="Atención" badgeTone="amber" />
                            <KpiCard icon="trending" label="Horas Perdidas" value={`${analitica.horas} h`} sub="Sujetas a descuento" badge="Impacto" badgeTone="red" />
                            <KpiCard icon="users" label="Colaboradores Afectados" value={String(analitica.ranking.length)} sub={`de ${empleados.length}`} badge="Ranking" badgeTone="purple" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            <Card>
                                <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Distribución por Tipo</h3>
                                {analitica.total === 0 ? <Empty text="No hay inasistencias registradas." /> : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        {TIPOS.filter((t) => analitica.porTipo[t]).map((t) => {
                                            const c = analitica.porTipo[t];
                                            const pct = Math.round((c / analitica.total) * 100);
                                            return (
                                                <div key={t}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <span style={{ fontSize: 13, color: colors.textBody }}>{t.replace(/_/g, ' ')}</span>
                                                        <span style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{c} ({pct}%)</span>
                                                    </div>
                                                    <Progress value={pct} color={t === 'Injustificada' || t === 'Permiso_sin_goce' ? colors.orange : colors.navy900} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </Card>
                            <Card>
                                <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Ranking de Ausentismo</h3>
                                {analitica.ranking.length === 0 ? <Empty text="Sin datos de ausentismo." /> : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {analitica.ranking.slice(0, 6).map((r: any, idx: number) => (
                                            <div key={r.nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: colors.bg, borderRadius: radius.md }}>
                                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                    <div style={{ width: 26, height: 26, borderRadius: radius.pill, background: idx === 0 ? colors.orange : colors.navy900, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{idx + 1}</div>
                                                    <span style={{ fontSize: 14, fontWeight: 600, color: colors.textStrong }}>{r.nombre}</span>
                                                </div>
                                                <Badge tone={idx === 0 ? 'orange' : 'gray'}>{r.count} inasist.</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </div>
                    </>
                )
            )}

            {tab === 'Gestión de Turnos' && <TurnosTab empleados={empleados} />}
            {tab === 'Permisos y Justificaciones' && <PermisosTab empleados={empleados} inasistencias={inasistencias} refrescar={refrescar} />}
            {tab === 'Panel de IA' && <AIPanelTab 
                empleadoId={empleadoSel} 
                messages={chatSessions[empleadoSel || 'global'] || []} 
                setMessages={(msgs) => setChatSessions(prev => ({ ...prev, [empleadoSel || 'global']: msgs }))} 
            />}

            {modal && <ModalInasistencia empleados={empleados} onClose={() => setModal(false)} onSaved={refrescar} />}
        </div>
    );
}
