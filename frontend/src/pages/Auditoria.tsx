import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors, radius } from '../theme';
import Icon from '../components/Icons';
import { Card, PageHeader, Tabs, KpiCard, Badge, Btn, Loading, Empty, Modal, tableStyles, downloadCSV, useToast } from '../components/ui';

const money = (n: any) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ESTADO_TONE: Record<string, any> = { Borrador: 'gray', Revision: 'amber', Aprobado: 'blue', Pagado: 'green' };
const ACCION_LABEL: Record<string, string> = {
    CREAR_NOMINA: 'Creación de nómina', CONSOLIDAR_NOMINA: 'Consolidación de planilla', CAMBIO_ESTADO_NOMINA: 'Cambio de estado de nómina',
};

export default function Auditoria() {
    const toast = useToast();
    const [tab, setTab] = useState('Registro de Auditoría');
    const [eventos, setEventos] = useState<any[]>([]);
    const [nominas, setNominas] = useState<any[]>([]);
    const [notifs, setNotifs] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [generando, setGenerando] = useState(false);
    const [detalle, setDetalle] = useState<{ nomina: any; boletas: any[] } | null>(null);
    const [descargandoId, setDescargandoId] = useState<number | null>(null);

    const cargar = async () => {
        setCargando(true);
        const [au, nm, nt] = await Promise.allSettled([
            api.get('/core/auditoria'), api.get('/nominas/'), api.get('/core/notificaciones'),
        ]);
        setEventos(au.status === 'fulfilled' && Array.isArray(au.value.data) ? au.value.data : []);
        setNominas(nm.status === 'fulfilled' && Array.isArray(nm.value.data) ? nm.value.data : []);
        setNotifs(nt.status === 'fulfilled' && Array.isArray(nt.value.data) ? nt.value.data : []);
        setCargando(false);
    };
    useEffect(() => { cargar(); }, []);

    const verificarContratos = async () => {
        try {
            setGenerando(true);
            const res = await api.post('/core/notificaciones/verificar-contratos');
            toast('success', `Verificación completada. Notificaciones generadas: ${res.data.notificaciones_creadas ?? 0}`);
            cargar(); setTab('Notificaciones');
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo ejecutar la verificación.');
        } finally { setGenerando(false); }
    };

    const fetchBoletas = async (nominaId: number) => {
        const res = await api.get(`/nominas/${nominaId}/boletas`);
        return Array.isArray(res.data) ? res.data : [];
    };

    const descargarReporte = async (nomina: any) => {
        try {
            setDescargandoId(nomina.id);
            const boletas = await fetchBoletas(nomina.id);
            if (boletas.length === 0) { toast('warning', 'Esta nómina aún no tiene boletas. Consolídala primero en el módulo de Nómina.'); return; }
            const rows: (string | number)[][] = [
                ['Reporte de Planilla', `Periodo ${nomina.periodo}`, `Estado: ${nomina.estado}`],
                [],
                ['Empleado', 'Cargo', 'Sueldo Base', 'Haberes', 'Desc. Inasistencias', 'Aporte Pensión', 'IR 5ta', 'Total Descuentos', 'Neto'],
                ...boletas.map((b: any) => [
                    b.nombre_empleado, b.cargo || '', b.sueldo_base, b.haberes,
                    b.descuento_inasistencias ?? 0, b.aporte_pension ?? 0, b.impuesto_renta_5ta ?? 0, b.total_descuentos, b.sueldo_neto,
                ]),
                [],
                ['Totales', '', nomina.total_ingresos, '', '', '', '', nomina.total_descuentos, nomina.total_neto],
            ];
            downloadCSV(`planilla_${nomina.periodo}.csv`, rows);
        } catch (err) {
            console.error(err); toast('error', 'No se pudo generar el reporte.');
        } finally { setDescargandoId(null); }
    };

    const verDetalle = async (nomina: any) => {
        try {
            const boletas = await fetchBoletas(nomina.id);
            setDetalle({ nomina, boletas });
        } catch (err) { console.error(err); toast('error', 'No se pudieron cargar los detalles.'); }
    };

    const exportarEventos = () => {
        const rows: (string | number)[][] = [
            ['Fecha', 'Usuario', 'Acción', 'Módulo', 'Detalles'],
            ...eventos.map((e) => [
                new Date(e.fecha_evento).toLocaleString('es-PE'), e.usuario,
                ACCION_LABEL[e.accion] || e.accion, e.modulo,
                e.detalles ? JSON.stringify(e.detalles) : '',
            ]),
        ];
        downloadCSV('registro_auditoria.csv', rows);
    };

    const aprobadas = nominas.filter((n) => ['Aprobado', 'Pagado'].includes(n.estado)).length;

    return (
        <div>
            <PageHeader
                title="Auditoría y Cumplimiento"
                subtitle="Trazabilidad de acciones, reportes de nómina y alertas normativas"
                action={<Btn icon="refresh" variant="orange" onClick={verificarContratos} disabled={generando}>{generando ? 'Verificando…' : 'Verificar Contratos'}</Btn>}
            />

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
                <KpiCard icon="shield" label="Eventos de Auditoría" value={String(eventos.length)} sub="Acciones registradas" badge="Trazado" badgeTone="purple" />
                <KpiCard icon="file" label="Nóminas" value={String(nominas.length)} sub="Reportes disponibles" badge="Real" badgeTone="blue" />
                <KpiCard icon="check" label="Aprobadas / Pagadas" value={String(aprobadas)} sub={`de ${nominas.length} nóminas`} badge="Cumplido" badgeTone="green" />
                <KpiCard icon="alert" label="Alertas Activas" value={String(notifs.length)} sub="Notificaciones del sistema" badge="Atención" badgeTone="amber" />
            </div>

            <Tabs tabs={['Registro de Auditoría', 'Reportes de Nómina', 'Notificaciones']} active={tab} onChange={setTab} />

            {cargando ? <Card><Loading /></Card> : (
                <>
                    {tab === 'Registro de Auditoría' && (
                        <Card>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Registro de Auditoría (RF-16)</h3>
                                    <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textMuted }}>Trazabilidad de las acciones realizadas por los usuarios.</p>
                                </div>
                                {eventos.length > 0 && <Btn size="sm" variant="indigo" icon="download" onClick={exportarEventos}>Exportar CSV</Btn>}
                            </div>
                            {eventos.length === 0 ? <Empty text="Sin eventos de auditoría todavía. Genera o consolida una nómina para ver actividad." /> : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={tableStyles.table}>
                                        <thead><tr>
                                            <th style={tableStyles.th}>Fecha</th>
                                            <th style={tableStyles.th}>Usuario</th>
                                            <th style={tableStyles.th}>Acción</th>
                                            <th style={tableStyles.th}>Módulo</th>
                                            <th style={tableStyles.th}>Detalles</th>
                                        </tr></thead>
                                        <tbody>
                                            {eventos.map((e) => (
                                                <tr key={e.id}>
                                                    <td style={{ ...tableStyles.td, color: colors.textMuted, whiteSpace: 'nowrap' }}>{new Date(e.fecha_evento).toLocaleString('es-PE')}</td>
                                                    <td style={{ ...tableStyles.td, fontWeight: 600, color: colors.textStrong }}>{e.usuario}</td>
                                                    <td style={tableStyles.td}><Badge tone="purple">{ACCION_LABEL[e.accion] || e.accion}</Badge></td>
                                                    <td style={tableStyles.td}>{e.modulo}</td>
                                                    <td style={{ ...tableStyles.td, color: colors.textMuted, fontSize: 12.5 }}>{e.detalles ? JSON.stringify(e.detalles) : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    )}

                    {tab === 'Reportes de Nómina' && (
                        <Card>
                            <div style={{ marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Reportes de Planilla</h3>
                                <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textMuted }}>Documentación de cada periodo. Descarga en CSV o revisa el detalle.</p>
                            </div>
                            {nominas.length === 0 ? <Empty text="No hay nóminas generadas. Crea una en el módulo de Nómina." /> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {nominas.map((n) => (
                                        <div key={n.id} style={{ border: `1px solid ${colors.border}`, borderLeft: `4px solid ${colors.orange}`, borderRadius: radius.md, padding: 18 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                                                <div style={{ flex: 1, minWidth: 240 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 15, fontWeight: 700, color: colors.textStrong }}>Planilla — {n.periodo}</span>
                                                        <Badge tone={ESTADO_TONE[n.estado] || 'gray'}>{n.estado}</Badge>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                                                        <div><p style={{ margin: 0, fontSize: 11.5, color: colors.textMuted }}>Total Ingresos</p><p style={{ margin: '2px 0 0', fontSize: 13.5, color: colors.textStrong }}>{money(n.total_ingresos)}</p></div>
                                                        <div><p style={{ margin: 0, fontSize: 11.5, color: colors.textMuted }}>Descuentos</p><p style={{ margin: '2px 0 0', fontSize: 13.5, color: colors.redText }}>-{money(n.total_descuentos)}</p></div>
                                                        <div><p style={{ margin: 0, fontSize: 11.5, color: colors.textMuted }}>Neto</p><p style={{ margin: '2px 0 0', fontSize: 13.5, fontWeight: 700, color: colors.greenText }}>{money(n.total_neto)}</p></div>
                                                        <div><p style={{ margin: 0, fontSize: 11.5, color: colors.textMuted }}>Creada</p><p style={{ margin: '2px 0 0', fontSize: 13.5, color: colors.textBody }}>{new Date(n.fecha_creacion).toLocaleDateString('es-PE')}</p></div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <Btn size="sm" variant="indigo" icon="download" onClick={() => descargarReporte(n)} disabled={descargandoId === n.id}>{descargandoId === n.id ? 'Generando…' : 'Descargar'}</Btn>
                                                    <Btn size="sm" variant="outline" icon="search" onClick={() => verDetalle(n)}>Ver Detalles</Btn>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {tab === 'Notificaciones' && (
                        <Card>
                            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Notificaciones y Alertas del Sistema</h3>
                            {notifs.length === 0 ? <Empty text="No hay notificaciones. Pulsa “Verificar Contratos” para generar alertas de vencimiento." /> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {notifs.map((n) => (
                                        <div key={n.notificacion_id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, background: colors.bg, borderRadius: radius.md, borderLeft: `3px solid ${n.leido ? colors.border : colors.orange}` }}>
                                            <Icon name={n.leido ? 'check' : 'alert'} size={18} color={n.leido ? colors.textFaint : colors.orange} style={{ marginTop: 2 }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.textStrong }}>{n.titulo}</p>
                                                    {!n.leido && <Badge tone="orange">Nueva</Badge>}
                                                </div>
                                                <p style={{ margin: '3px 0 0', fontSize: 13, color: colors.textMuted }}>{n.mensaje}</p>
                                                <p style={{ margin: '4px 0 0', fontSize: 11.5, color: colors.textFaint }}>{new Date(n.fecha_creacion).toLocaleString('es-PE')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}
                </>
            )}

            {detalle && (
                <Modal title={`Detalle de Planilla — ${detalle.nomina.periodo}`} onClose={() => setDetalle(null)} width={760}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                        <Badge tone={ESTADO_TONE[detalle.nomina.estado] || 'gray'}>{detalle.nomina.estado}</Badge>
                        <Badge tone="blue">Ingresos {money(detalle.nomina.total_ingresos)}</Badge>
                        <Badge tone="red">Descuentos {money(detalle.nomina.total_descuentos)}</Badge>
                        <Badge tone="green">Neto {money(detalle.nomina.total_neto)}</Badge>
                    </div>
                    {detalle.boletas.length === 0 ? <Empty text="Esta nómina no tiene boletas (no ha sido consolidada)." /> : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={tableStyles.table}>
                                <thead><tr>
                                    <th style={tableStyles.th}>Empleado</th>
                                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Básico</th>
                                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Pensión</th>
                                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>IR 5ta</th>
                                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Neto</th>
                                </tr></thead>
                                <tbody>
                                    {detalle.boletas.map((b) => (
                                        <tr key={b.detalle_id}>
                                            <td style={{ ...tableStyles.td, fontWeight: 600, color: colors.textStrong }}>{b.nombre_empleado}</td>
                                            <td style={{ ...tableStyles.td, textAlign: 'right' }}>{money(b.sueldo_base)}</td>
                                            <td style={{ ...tableStyles.td, textAlign: 'right', color: colors.redText }}>-{money(b.aporte_pension)}</td>
                                            <td style={{ ...tableStyles.td, textAlign: 'right', color: colors.redText }}>-{money(b.impuesto_renta_5ta)}</td>
                                            <td style={{ ...tableStyles.td, textAlign: 'right', fontWeight: 700, color: colors.greenText }}>{money(b.sueldo_neto)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
                        <Btn variant="indigo" icon="download" onClick={() => descargarReporte(detalle.nomina)}>Descargar CSV</Btn>
                    </div>
                </Modal>
            )}
        </div>
    );
}
