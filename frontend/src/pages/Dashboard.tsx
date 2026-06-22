import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors, radius } from '../theme';
import Icon from '../components/Icons';
import { Card, PageHeader, KpiCard, Badge, Progress, Loading, Empty } from '../components/ui';

const money = (n: any) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ESTADO_TONE: Record<string, any> = { Borrador: 'gray', Revision: 'amber', Aprobado: 'blue', Pagado: 'green' };

// ── Gráfico de línea/área sobre datos reales ──
function LineChart({ labels, values }: { labels: string[]; values: number[] }) {
    const W = 620, H = 240, padL = 56, padB = 28, padT = 14, padR = 14;
    if (values.length === 0) return <Empty text="Aún no hay nóminas para graficar." />;

    const single = values.length === 1;
    const xs = single ? [W / 2] : labels.map((_, i) => padL + (i * (W - padL - padR)) / (labels.length - 1));
    let min = Math.min(...values), max = Math.max(...values);
    if (min === max) { min = min * 0.9; max = max * 1.1 || 1; }
    const pad = (max - min) * 0.15; min -= pad; max += pad;
    const y = (v: number) => padT + ((max - v) * (H - padT - padB)) / (max - min);

    const pts = values.map((v, i) => [xs[i], y(v)]);
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
    const area = `${line} L ${xs[xs.length - 1]} ${H - padB} L ${xs[0]} ${H - padB} Z`;
    const gridVals = [min, (min + max) / 2, max];

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
            <defs>
                <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.orange} stopOpacity="0.20" />
                    <stop offset="100%" stopColor={colors.orange} stopOpacity="0" />
                </linearGradient>
            </defs>
            {gridVals.map((g, i) => (
                <g key={i}>
                    <line x1={padL} y1={y(g)} x2={W - padR} y2={y(g)} stroke={colors.borderSoft} strokeWidth="1" />
                    <text x={padL - 8} y={y(g) + 4} textAnchor="end" fontSize="10" fill={colors.textFaint}>{Math.round(g / 1000)}k</text>
                </g>
            ))}
            {labels.map((m, i) => (
                <text key={m + i} x={xs[i]} y={H - padB + 16} textAnchor="middle" fontSize="10" fill={colors.textFaint}>{m}</text>
            ))}
            {!single && <path d={area} fill="url(#gArea)" />}
            {!single && <path d={line} fill="none" stroke={colors.orange} strokeWidth="2.5" />}
            {pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#fff" stroke={colors.orange} strokeWidth="2.5" />
            ))}
        </svg>
    );
}

function ControlItem({ icon, title, sub, value, pct, tone }: { icon: string; title: string; sub: string; value: string; pct: number; tone: string }) {
    return (
        <div style={{ background: colors.bg, borderRadius: radius.md, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: radius.pill, background: tone === 'orange' ? colors.orange : colors.navy900, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={icon} size={18} />
                </div>
                <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.textStrong }}>{title}</p>
                    <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>{sub}</p>
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: tone === 'orange' ? colors.orange : colors.textStrong }}>{value}</span>
            </div>
            <Progress value={pct} color={tone === 'orange' ? colors.orange : colors.navy900} />
        </div>
    );
}

const ACCION_LABEL: Record<string, string> = {
    CREAR_NOMINA: 'Creó una nómina', CONSOLIDAR_NOMINA: 'Consolidó la planilla', CAMBIO_ESTADO_NOMINA: 'Cambió el estado de nómina',
};

export default function Dashboard() {
    const [d, setD] = useState<any>(null);
    const [notifs, setNotifs] = useState<any[]>([]);
    const [eventos, setEventos] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);

    const cargar = async () => {
        setCargando(true);
        const [emp, con, nom, nt, au] = await Promise.allSettled([
            api.get('/empleados/'), api.get('/empleados/contratos'), api.get('/nominas/'),
            api.get('/core/notificaciones'), api.get('/core/auditoria'),
        ]);
        const empleados = emp.status === 'fulfilled' && Array.isArray(emp.value.data) ? emp.value.data : [];
        const contratos = con.status === 'fulfilled' && Array.isArray(con.value.data) ? con.value.data : [];
        const nominas = nom.status === 'fulfilled' && Array.isArray(nom.value.data) ? nom.value.data : [];
        const vigentes = contratos.filter((c: any) => c.estado === 'Vigente');
        const empleadosConVigente = new Set(vigentes.map((c: any) => c.empleado_id));
        const ordenadas = [...nominas].sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));

        setD({
            empleados, vigentes, nominas: ordenadas,
            activos: empleados.filter((e: any) => e.estado === 'Activo').length,
            total: empleados.length,
            horasMes: vigentes.reduce((s: number, c: any) => s + Number(c.horas_contrato_mes || 0), 0),
            masaSalarial: vigentes.reduce((s: number, c: any) => s + Number(c.sueldo_base || 0), 0),
            cobertura: empleados.length ? Math.round((empleadosConVigente.size / empleados.length) * 100) : 0,
            cumplimiento: nominas.length ? Math.round((nominas.filter((n: any) => ['Aprobado', 'Pagado'].includes(n.estado)).length / nominas.length) * 100) : 0,
            ultima: ordenadas[ordenadas.length - 1],
        });
        if (nt.status === 'fulfilled' && Array.isArray(nt.value.data)) setNotifs(nt.value.data);
        if (au.status === 'fulfilled' && Array.isArray(au.value.data)) setEventos(au.value.data);
        setCargando(false);
    };

    useEffect(() => { cargar(); }, []);

    if (cargando || !d) {
        return (<div><PageHeader title="Dashboard de Gestión" subtitle="Resumen operativo en tiempo real" /><Card><Loading text="Cargando indicadores…" /></Card></div>);
    }

    const activosPct = d.total ? Math.round((d.activos / d.total) * 100) : 0;

    return (
        <div>
            <PageHeader
                title="Dashboard de Gestión"
                subtitle="Resumen operativo en tiempo real sobre personal, contratos y nómina"
                action={<Badge tone="green"><Icon name="refresh" size={13} /> Datos en vivo</Badge>}
            />

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
                <KpiCard icon="users" label="Empleados Activos" value={String(d.activos)} sub={`${d.total} registrados`} badge={`${activosPct}%`} badgeTone="green" />
                <KpiCard icon="clock" label="Horas Contratadas / mes" value={d.horasMes.toLocaleString('es-PE')} sub={`${d.vigentes.length} contratos vigentes`} badge="Vigente" badgeTone="blue" />
                <KpiCard icon="dollar" label="Masa Salarial Mensual" value={money(d.masaSalarial)} sub="Suma de sueldos base vigentes" badge="Base" badgeTone="amber" />
                <KpiCard icon="file" label="Nóminas" value={String(d.nominas.length)} sub={d.ultima ? `Última: ${d.ultima.periodo} (${d.ultima.estado})` : 'Sin generar'} badge={d.ultima ? d.ultima.estado : '—'} badgeTone={d.ultima ? ESTADO_TONE[d.ultima.estado] : 'gray'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, marginBottom: 22 }}>
                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Evolución de Nómina Neta</h3>
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textMuted }}>Total neto pagado por periodo</p>
                        </div>
                        <Badge tone="orange"><Icon name="trending" size={13} /> Real</Badge>
                    </div>
                    <LineChart labels={d.nominas.map((n: any) => n.periodo)} values={d.nominas.map((n: any) => Number(n.total_neto))} />
                </Card>

                <Card>
                    <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Resumen de Control Operativo</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <ControlItem icon="users" title="Personal Activo" sub={`${d.activos} de ${d.total} colaboradores`} value={`${activosPct}%`} pct={activosPct} tone="orange" />
                        <ControlItem icon="file" title="Cobertura de Contratos" sub="Empleados con contrato vigente" value={`${d.cobertura}%`} pct={d.cobertura} tone="navy" />
                        <ControlItem icon="check" title="Cumplimiento de Nómina" sub="Nóminas aprobadas o pagadas" value={`${d.cumplimiento}%`} pct={d.cumplimiento} tone="navy" />
                    </div>
                </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Notificaciones del Sistema</h3>
                        {notifs.length > 0 && <Badge tone="orange">{notifs.length}</Badge>}
                    </div>
                    {notifs.length === 0 ? <p style={{ fontSize: 13, color: colors.textFaint, margin: 0 }}>No hay notificaciones pendientes.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {notifs.slice(0, 4).map((n) => (
                                <div key={n.notificacion_id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, background: colors.bg, borderRadius: radius.md, borderLeft: `3px solid ${colors.orange}` }}>
                                    <Icon name="bell" size={18} color={colors.orange} style={{ marginTop: 2 }} />
                                    <div>
                                        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: colors.textStrong }}>{n.titulo}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: colors.textMuted }}>{n.mensaje}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card>
                    <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Actividad Reciente</h3>
                    {eventos.length === 0 ? <p style={{ fontSize: 13, color: colors.textFaint, margin: 0 }}>Sin actividad registrada todavía.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {eventos.slice(0, 5).map((e) => (
                                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: colors.bg, borderRadius: radius.md }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                                        <Icon name="shield" size={18} color={colors.navy900} />
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: colors.textStrong, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ACCION_LABEL[e.accion] || e.accion}</p>
                                            <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>{e.usuario} · {e.modulo}</p>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 11.5, color: colors.textFaint, whiteSpace: 'nowrap' }}>{new Date(e.fecha_evento).toLocaleDateString('es-PE')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
