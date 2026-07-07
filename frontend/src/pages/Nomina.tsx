import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors, radius, font } from '../theme';
import Icon from '../components/Icons';
import { Card, PageHeader, Tabs, KpiCard, Badge, Btn, Loading, Empty, tableStyles, inputStyle, Field, Select, downloadCSV, useToast } from '../components/ui';
import BeneficiosSocialesTab from '../components/BeneficiosSocialesTab';
import ConceptosVariablesTab from '../components/ConceptosVariablesTab';

const money = (n: any) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ESTADO_TONE: Record<string, any> = { Borrador: 'gray', Revision: 'amber', Aprobado: 'blue', Pagado: 'green' };

function ModalNomina({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
    const toast = useToast();
    const [periodo, setPeriodo] = useState('');
    const [guardando, setGuardando] = useState(false);
    const crear = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!periodo) return;
        try {
            setGuardando(true);
            const res = await api.post('/nominas/', { periodo });
            onSaved(res.data.id); onClose();
            toast('success', 'Nómina creada correctamente en estado Borrador.');
        } catch (err: any) {
            console.error(err);
            toast('error', err?.response?.data?.detail || 'No se pudo crear la nómina.');
        } finally { setGuardando(false); }
    };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,19,40,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: radius.lg, padding: 28, width: 400, fontFamily: font, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700, color: colors.textStrong }}>Nueva Nómina</h3>
                <form onSubmit={crear} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Field label="Periodo (mes)"><input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={inputStyle} required /></Field>
                    <p style={{ fontSize: 12, color: colors.textMuted, margin: 0 }}>Se creará en estado <strong>Borrador</strong>. Luego podrás consolidar el cálculo.</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
                        <Btn type="submit" variant="orange" disabled={guardando}>{guardando ? 'Creando…' : 'Crear Nómina'}</Btn>
                    </div>
                </form>
            </div>
        </div>
    );
}

const rolActual = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').rol; } catch { return undefined; } })();
const puedeEditarHoras = ['Admin', 'RRHH', 'SuperAdmin'].includes(rolActual);

export default function Nomina() {
    const toast = useToast();
    const [tab, setTab] = useState('Cálculo de Planilla');
    const [nominas, setNominas] = useState<any[]>([]);
    const [selId, setSelId] = useState<number | null>(null);
    const [nomina, setNomina] = useState<any | null>(null);
    const [boletas, setBoletas] = useState<any[]>([]);
    const [historial, setHistorial] = useState<any[]>([]);
    const [alertas, setAlertas] = useState<any[]>([]);   // Fase 2: auditoría normativa
    const [horas, setHoras] = useState<any[]>([]);        // Fase 2: captura de horas
    const [cargando, setCargando] = useState(false);
    const [modal, setModal] = useState(false);
    const [accion, setAccion] = useState(false);

    const bloqueos = alertas.filter((a) => a.nivel === 'bloqueo');

    const cargarNominas = async (preferId?: number) => {
        try {
            const res = await api.get('/nominas/');
            const list = Array.isArray(res.data) ? res.data : [];
            setNominas(list);
            if (preferId) setSelId(preferId);
            else if (!selId && list.length) setSelId(list[0].id);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { cargarNominas(); }, []);

    const cargarDetalle = async (id: number) => {
        try {
            setCargando(true);
            const [n, b, h, a] = await Promise.allSettled([
                api.get(`/nominas/${id}`), api.get(`/nominas/${id}/boletas`),
                api.get(`/nominas/${id}/historial`), api.get(`/nominas/${id}/auditoria`),
            ]);
            if (n.status === 'fulfilled') setNomina(n.value.data);
            setBoletas(b.status === 'fulfilled' && Array.isArray(b.value.data) ? b.value.data : []);
            setHistorial(h.status === 'fulfilled' && Array.isArray(h.value.data) ? h.value.data : []);
            setAlertas(a.status === 'fulfilled' && Array.isArray(a.value.data) ? a.value.data : []);
        } catch (e) { console.error(e); }
        finally { setCargando(false); }
    };

    const cargarHoras = async (id: number) => {
        try {
            const res = await api.get(`/nominas/${id}/horas`);
            setHoras(Array.isArray(res.data) ? res.data : []);
        } catch (e) { console.error(e); setHoras([]); }
    };

    useEffect(() => { if (selId) cargarDetalle(selId); }, [selId]);
    useEffect(() => { if (selId && tab === 'Horas Extra' && puedeEditarHoras) cargarHoras(selId); }, [selId, tab]);

    const guardarHoras = async (fila: any) => {
        if (!selId) return;
        try {
            await api.post(`/nominas/${selId}/horas`, {
                empleado_id: fila.empleado_id,
                horas_extra_25: Number(fila.horas_extra_25) || 0,
                horas_extra_35: Number(fila.horas_extra_35) || 0,
                horas_nocturnas: Number(fila.horas_nocturnas) || 0,
            });
            toast('success', `Horas guardadas para ${fila.nombre}. Vuelve a consolidar para aplicarlas.`);
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudieron guardar las horas.');
        }
    };

    const setHoraCampo = (empleado_id: number, campo: string, valor: string) => {
        setHoras((prev) => prev.map((f) => (f.empleado_id === empleado_id ? { ...f, [campo]: valor } : f)));
    };

    const consolidar = async () => {
        if (!selId) return;
        try {
            setAccion(true);
            const res = await api.post(`/nominas/${selId}/consolidar`);
            const bloq = res.data.bloqueos_normativos || 0;
            if (bloq > 0) {
                toast('warning', `Planilla consolidada con ${bloq} bloqueo(s) normativo(s). Revísalos antes de aprobar.`);
            } else {
                toast('success', `Planilla consolidada: ${res.data.empleados_procesados} empleados procesados.`);
            }
            cargarDetalle(selId); cargarNominas(selId);
        } catch (err: any) {
            console.error(err);
            toast('error', err?.response?.data?.detail || 'No se pudo consolidar.');
        } finally { setAccion(false); }
    };

    const cambiarEstado = async (nuevo_estado: string) => {
        if (!selId) return;
        try {
            setAccion(true);
            await api.patch(`/nominas/${selId}/estado`, { nuevo_estado });
            toast('success', `Estado actualizado a "${nuevo_estado}" correctamente.`);
            cargarDetalle(selId); cargarNominas(selId);
        } catch (err: any) {
            console.error(err);
            const d = err?.response?.data?.detail;
            // Fase 2: el bloqueo normativo llega como objeto {mensaje, bloqueos}.
            const msg = typeof d === 'string' ? d : (d?.mensaje || 'No se pudo cambiar el estado.');
            toast('error', msg);
            if (d && typeof d === 'object' && d.bloqueos) { cargarDetalle(selId); }
        } finally { setAccion(false); }
    };

    const exportarPlanilla = () => {
        if (!boletas.length) return;
        const rows: (string | number)[][] = [
            ['Planilla', `Periodo ${nomina?.periodo || ''}`, `Estado: ${nomina?.estado || ''}`],
            [],
            ['Empleado', 'Cargo', 'Sueldo Base', 'Haberes', 'Desc. Inasistencias', 'Aporte Pensión', 'IR 5ta', 'Total Descuentos', 'Neto'],
            ...boletas.map((b) => [
                b.nombre_empleado, b.cargo || '', b.sueldo_base, b.haberes,
                b.descuento_inasistencias ?? 0, b.aporte_pension ?? 0, b.impuesto_renta_5ta ?? 0, b.total_descuentos, b.sueldo_neto,
            ]),
            [],
            ['Totales', '', nomina?.total_ingresos ?? 0, '', '', '', '', nomina?.total_descuentos ?? 0, nomina?.total_neto ?? 0],
        ];
        downloadCSV(`planilla_${nomina?.periodo || 'nomina'}.csv`, rows);
    };

    const estado = nomina?.estado || 'Borrador';
    const bloqueada = estado === 'Aprobado' || estado === 'Pagado';

    const accionesEstado = () => {
        if (estado === 'Borrador') return (<>
            <Btn variant="indigo" icon="refresh" onClick={consolidar} disabled={accion}>Consolidar Cálculo</Btn>
            <Btn variant="orange" icon="chevronRight" onClick={() => cambiarEstado('Revision')} disabled={accion}>Enviar a Revisión</Btn>
        </>);
        if (estado === 'Revision') return (<>
            <Btn variant="outline" onClick={() => cambiarEstado('Borrador')} disabled={accion}>Devolver a Borrador</Btn>
            <Btn variant="green" icon="check" onClick={() => cambiarEstado('Aprobado')} disabled={accion || bloqueos.length > 0}
                style={bloqueos.length > 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
                {bloqueos.length > 0 ? `Aprobar (${bloqueos.length} bloqueo${bloqueos.length > 1 ? 's' : ''})` : 'Aprobar'}
            </Btn>
        </>);
        if (estado === 'Aprobado') return (<>
            <Btn variant="outline" onClick={() => cambiarEstado('Revision')} disabled={accion}>Devolver a Revisión</Btn>
            <Btn variant="green" icon="dollar" onClick={() => cambiarEstado('Pagado')} disabled={accion}>Marcar como Pagado</Btn>
        </>);
        return <Badge tone="green"><Icon name="check" size={13} /> Planilla pagada y cerrada</Badge>;
    };

    return (
        <div>
            <PageHeader
                title="Automatización de Nómina"
                subtitle="Cálculo automático, boletas y flujo de aprobación de planillas"
                action={<Btn icon="plus" onClick={() => setModal(true)}>Nueva Nómina</Btn>}
            />

            {nominas.length === 0 ? (
                <Card><Empty text="No hay nóminas todavía. Crea la primera con “Nueva Nómina”." /></Card>
            ) : (
                <>
                    {/* Selector + estado + acciones */}
                    <Card style={{ marginBottom: 22 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                <Field label="Periodo">
                                    <Select value={selId ?? ''} onChange={(v) => setSelId(Number(v))} style={{ width: 200 }}>
                                        {nominas.map((n) => <option key={n.id} value={n.id}>{n.periodo}</option>)}
                                    </Select>
                                </Field>
                                <div style={{ marginTop: 6 }}>
                                    <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>Estado actual</p>
                                    <div style={{ marginTop: 4 }}><Badge tone={ESTADO_TONE[estado] || 'gray'}>{estado}</Badge></div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{accionesEstado()}</div>
                        </div>
                        {bloqueada && (
                            <p style={{ margin: '14px 0 0', fontSize: 12.5, color: colors.orangeText, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Icon name="shield" size={14} /> Nómina bloqueada: en estado “{estado}” no se permite reconsolidar ni editar.
                            </p>
                        )}
                    </Card>

                    {/* Fase 2: banner de auditoría normativa */}
                    {bloqueos.length > 0 && (
                        <div style={{ background: colors.redSoft, border: `1px solid #FCA5A5`, borderRadius: radius.md, padding: '14px 18px', marginBottom: 22, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <Icon name="alert" size={18} color={colors.redText} />
                            <div>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.redText }}>
                                    Auditoría normativa: {bloqueos.length} bloqueo{bloqueos.length > 1 ? 's' : ''} legal{bloqueos.length > 1 ? 'es' : ''}
                                </p>
                                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: colors.textBody }}>
                                    La planilla no puede aprobarse hasta resolverlos. Revisa el detalle en la pestaña <strong>Auditoría Normativa</strong>.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* KPIs */}
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
                        <KpiCard icon="dollar" label="Total Ingresos" value={money(nomina?.total_ingresos)} sub={`Periodo ${nomina?.periodo || ''}`} badge={estado} badgeTone={ESTADO_TONE[estado]} />
                        <KpiCard icon="trending" label="Total Descuentos" value={money(nomina?.total_descuentos)} sub="AFP / ONP, IR 5ta, faltas" badge="Ley" badgeTone="amber" />
                        <KpiCard icon="check" label="Total Neto" value={money(nomina?.total_neto)} sub="A pagar" badge="Neto" badgeTone="green" />
                        <KpiCard icon="users" label="Boletas" value={String(boletas.length)} sub="Empleados procesados" badge={boletas.length ? 'Listas' : 'Pendiente'} badgeTone={boletas.length ? 'green' : 'gray'} />
                    </div>

                    <Tabs
                        tabs={[
                            'Cálculo de Planilla',
                            ...(puedeEditarHoras ? ['Horas Extra'] : []),
                            `Auditoría Normativa${alertas.length ? ` (${alertas.length})` : ''}`,
                            'Distribución de Boletas',
                            'Historial',
                            'Beneficios Sociales',
                            'Conceptos Variables',
                        ]}
                        active={tab}
                        onChange={setTab}
                    />

                    {cargando ? <Card><Loading /></Card> : (
                        <>
                            {tab === 'Cálculo de Planilla' && (
                                <Card>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Cálculo Automático de Remuneraciones</h3>
                                            <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textMuted }}>Basado en contrato vigente, inasistencias y descuentos de ley.</p>
                                        </div>
                                        {boletas.length > 0 && <Btn variant="indigo" icon="download" onClick={exportarPlanilla}>Exportar CSV</Btn>}
                                    </div>
                                    {boletas.length === 0 ? <Empty text="Sin detalles. Pulsa “Consolidar Cálculo” para procesar la planilla." /> : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={tableStyles.table}>
                                                <thead><tr>
                                                    <th style={tableStyles.th}>Empleado</th>
                                                    <th style={tableStyles.th}>Cargo</th>
                                                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Básico</th>
                                                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Haberes</th>
                                                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Descuentos</th>
                                                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Neto</th>
                                                </tr></thead>
                                                <tbody>
                                                    {boletas.map((b) => (
                                                        <tr key={b.detalle_id}>
                                                            <td style={{ ...tableStyles.td, fontWeight: 600, color: colors.textStrong }}>{b.nombre_empleado}</td>
                                                            <td style={{ ...tableStyles.td, color: colors.textMuted }}>{b.cargo || '—'}</td>
                                                            <td style={{ ...tableStyles.td, textAlign: 'right' }}>{money(b.sueldo_base)}</td>
                                                            <td style={{ ...tableStyles.td, textAlign: 'right', color: colors.greenText }}>{money(b.haberes)}</td>
                                                            <td style={{ ...tableStyles.td, textAlign: 'right', color: colors.redText }}>-{money(b.total_descuentos)}</td>
                                                            <td style={{ ...tableStyles.td, textAlign: 'right', fontWeight: 700, color: colors.textStrong }}>{money(b.sueldo_neto)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Card>
                            )}

                            {tab === 'Horas Extra' && puedeEditarHoras && (
                                <Card>
                                    <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Captura de horas — {nomina?.periodo}</h3>
                                    <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted }}>
                                        Ingresa las horas de sobretiempo y nocturnas. Se valorizan al <strong>consolidar</strong> (25%, 35% y recargo nocturno 35%).
                                        {bloqueada && ' La nómina está bloqueada; las horas no son editables.'}
                                    </p>
                                    {horas.length === 0 ? <Empty text="No hay empleados activos para capturar horas." /> : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={tableStyles.table}>
                                                <thead><tr>
                                                    <th style={tableStyles.th}>Empleado</th>
                                                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Extra 25%</th>
                                                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Extra 35%</th>
                                                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Nocturnas</th>
                                                    <th style={{ ...tableStyles.th, textAlign: 'center' }}></th>
                                                </tr></thead>
                                                <tbody>
                                                    {horas.map((f) => (
                                                        <tr key={f.empleado_id}>
                                                            <td style={{ ...tableStyles.td, fontWeight: 600, color: colors.textStrong }}>{f.nombre}</td>
                                                            {['horas_extra_25', 'horas_extra_35', 'horas_nocturnas'].map((campo) => (
                                                                <td key={campo} style={{ ...tableStyles.td, textAlign: 'right' }}>
                                                                    <input type="number" min="0" step="0.5" disabled={bloqueada}
                                                                        value={f[campo]} onChange={(e) => setHoraCampo(f.empleado_id, campo, e.target.value)}
                                                                        style={{ ...inputStyle, width: 90, textAlign: 'right', padding: '6px 8px' }} />
                                                                </td>
                                                            ))}
                                                            <td style={{ ...tableStyles.td, textAlign: 'center' }}>
                                                                <Btn size="sm" variant="outline" icon="check" disabled={bloqueada} onClick={() => guardarHoras(f)}>Guardar</Btn>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Card>
                            )}

                            {tab.startsWith('Auditoría Normativa') && (
                                <Card>
                                    <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Auditoría Normativa</h3>
                                    <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted }}>
                                        Validación legal automática de la pre-nómina. Los <strong>bloqueos</strong> impiden aprobar la planilla.
                                    </p>
                                    {alertas.length === 0 ? (
                                        <Empty text="Sin hallazgos. Consolida la planilla para ejecutar la auditoría." />
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {alertas.map((a) => (
                                                <div key={a.id} style={{ border: `1px solid ${a.nivel === 'bloqueo' ? '#FCA5A5' : colors.border}`, background: a.nivel === 'bloqueo' ? colors.redSoft : '#fff', borderRadius: radius.md, padding: 14 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                                        <Badge tone={a.nivel === 'bloqueo' ? 'red' : 'amber'}>{a.nivel === 'bloqueo' ? 'Bloqueo' : 'Advertencia'}</Badge>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong }}>{a.concepto}</span>
                                                    </div>
                                                    <p style={{ margin: '2px 0 0', fontSize: 13.5, color: colors.textBody }}>{a.mensaje}</p>
                                                    {a.explicacion && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: colors.textMuted, display: 'flex', alignItems: 'flex-start', gap: 6 }}><Icon name="sparkles" size={14} color={colors.orange} />{a.explicacion}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            )}

                            {tab === 'Distribución de Boletas' && (
                                <Card>
                                    <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Boletas de Pago — {nomina?.periodo}</h3>
                                    {boletas.length === 0 ? <Empty text="Aún no hay boletas. Consolida la planilla primero." /> : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                                            {boletas.map((b) => (
                                                <div key={b.detalle_id} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 18 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                        <div>
                                                            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.textStrong }}>{b.nombre_empleado}</p>
                                                            <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.textMuted }}>{b.cargo || '—'} · {b.tipo_pension || '—'}</p>
                                                        </div>
                                                        <Icon name="file" size={22} color={colors.orange} />
                                                    </div>
                                                    {[
                                                        ['Sueldo base', money(b.sueldo_base)],
                                                        ...(Number(b.pago_horas_extra_25) > 0 ? [['H. extra 25%', '+' + money(b.pago_horas_extra_25)]] : []),
                                                        ...(Number(b.pago_horas_extra_35) > 0 ? [['H. extra 35%', '+' + money(b.pago_horas_extra_35)]] : []),
                                                        ...(Number(b.pago_horas_nocturnas) > 0 ? [['H. nocturnas', '+' + money(b.pago_horas_nocturnas)]] : []),
                                                        ...(Number(b.bonos_sector) > 0 ? [[`Bono sector${b.perfil_contrato ? ' (' + b.perfil_contrato + ')' : ''}`, '+' + money(b.bonos_sector)]] : []),
                                                        ['Desc. inasistencias', '-' + money(b.descuento_inasistencias)],
                                                        ['Aporte pensión', '-' + money(b.aporte_pension)],
                                                        ['Impuesto 5ta', '-' + money(b.impuesto_renta_5ta)],
                                                    ].map(([k, v]) => (
                                                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: colors.textBody }}>
                                                            <span style={{ color: colors.textMuted }}>{k}</span><span>{v}</span>
                                                        </div>
                                                    ))}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${colors.border}`, marginTop: 8, paddingTop: 10 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: colors.textStrong }}>Neto a pagar</span>
                                                        <span style={{ fontSize: 15, fontWeight: 700, color: colors.greenText }}>{money(b.sueldo_neto)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            )}

                            {tab === 'Historial' && (
                                <Card>
                                    <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Historial de Aprobación</h3>
                                    {historial.length === 0 ? <Empty text="Sin movimientos de estado todavía." /> : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                            {historial.map((h, i) => (
                                                <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 18, position: 'relative' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <div style={{ width: 12, height: 12, borderRadius: 999, background: colors.orange, flexShrink: 0, marginTop: 4 }} />
                                                        {i < historial.length - 1 && <div style={{ width: 2, flex: 1, background: colors.border, marginTop: 4 }} />}
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: 14, color: colors.textStrong }}>
                                                            <strong>{h.estado_anterior}</strong> → <strong>{h.estado_nuevo}</strong>
                                                        </p>
                                                        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: colors.textMuted }}>
                                                            {h.usuario} · {new Date(h.fecha).toLocaleString('es-PE')}
                                                        </p>
                                                        {h.comentarios && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: colors.textBody }}>{h.comentarios}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            )}

                            {tab === 'Beneficios Sociales' && <BeneficiosSocialesTab />}
                            {tab === 'Conceptos Variables' && <ConceptosVariablesTab />}
                        </>
                    )}
                </>
            )}

            {modal && <ModalNomina onClose={() => setModal(false)} onSaved={(id) => cargarNominas(id)} />}
        </div>
    );
}
