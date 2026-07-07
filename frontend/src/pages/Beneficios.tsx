import React, { useEffect, useState } from 'react';
import { colors, font } from '../theme';
import api from '../services/api';
import {
    Card, PageHeader, Badge, Loading, Empty, tableStyles, Btn, Field, Select,
    inputStyle, useToast, downloadCSV, Tabs,
} from '../components/ui';

// ============================================================================
// Fase 5 — Beneficios sociales (RRHH / Admin).
// Cálculo y consolidado de gratificaciones (Jul/Dic), CTS (May/Nov) y
// liquidaciones por cese. El backend aplica el factor por régimen de la empresa.
// ============================================================================

const soles = (n: number | string) =>
    'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Beneficio {
    beneficio_id: number;
    empleado_id: number;
    empleado_nombre?: string;
    tipo: string;
    periodo: string;
    monto: number;
    estado: string;
    fecha_calculo?: string;
    detalle?: any;
}

interface Empleado { empleado_id: number; nombre?: string; }

const ANIO_ACTUAL = new Date().getFullYear();

export default function Beneficios() {
    const toast = useToast();
    const [tab, setTab] = useState('Gratificaciones');
    const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [loading, setLoading] = useState(true);
    const [procesando, setProcesando] = useState(false);

    // Formularios
    const [gSem, setGSem] = useState('Julio');
    const [gAnio, setGAnio] = useState(String(ANIO_ACTUAL));
    const [cPer, setCPer] = useState('Noviembre');
    const [cAnio, setCAnio] = useState(String(ANIO_ACTUAL));
    const [lEmp, setLEmp] = useState('');
    const [lFecha, setLFecha] = useState(new Date().toISOString().slice(0, 10));
    const [lDias, setLDias] = useState('0');

    const cargar = async () => {
        try {
            const [b, e] = await Promise.all([
                api.get('/beneficios/beneficios'),
                api.get('/empleados/'),
            ]);
            setBeneficios(Array.isArray(b.data) ? b.data : []);
            setEmpleados(Array.isArray(e.data) ? e.data : []);
        } catch {
            toast('error', 'No se pudieron cargar los beneficios.');
        } finally { setLoading(false); }
    };

    useEffect(() => { cargar(); }, []);

    const calcGrati = async () => {
        setProcesando(true);
        try {
            const res = await api.post('/beneficios/gratificaciones/calcular', { semestre: gSem, anio: Number(gAnio) });
            toast('success', `Gratificaciones calculadas para ${res.data.length} empleado(s).`);
            cargar();
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo calcular.');
        } finally { setProcesando(false); }
    };

    const calcCts = async () => {
        setProcesando(true);
        try {
            const res = await api.post('/beneficios/cts/calcular', { periodo_cts: cPer, anio: Number(cAnio) });
            toast('success', `CTS calculada para ${res.data.length} empleado(s).`);
            cargar();
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo calcular.');
        } finally { setProcesando(false); }
    };

    const calcLiq = async () => {
        if (!lEmp) { toast('error', 'Selecciona un empleado.'); return; }
        setProcesando(true);
        try {
            await api.post('/beneficios/liquidaciones/calcular', {
                empleado_id: Number(lEmp), fecha_cese: lFecha, dias_vacaciones_pendientes: Number(lDias) || 0,
            });
            toast('success', 'Liquidación calculada.');
            cargar();
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo calcular.');
        } finally { setProcesando(false); }
    };

    const marcarPagado = async (id: number) => {
        try {
            await api.patch(`/beneficios/beneficios/${id}/pagar`);
            toast('success', 'Beneficio marcado como pagado.');
            cargar();
        } catch { toast('error', 'No se pudo actualizar.'); }
    };

    const exportar = () => {
        const rows: (string | number)[][] = [['Empleado', 'Tipo', 'Periodo', 'Monto', 'Estado']];
        beneficios.forEach((b) => rows.push([b.empleado_nombre || b.empleado_id, b.tipo, b.periodo, Number(b.monto).toFixed(2), b.estado]));
        downloadCSV('beneficios_sociales.csv', rows);
    };

    if (loading) return <Loading text="Cargando beneficios…" />;

    const filtrados = beneficios.filter((b) =>
        tab === 'Gratificaciones' ? b.tipo === 'Gratificacion'
            : tab === 'CTS' ? b.tipo === 'CTS'
                : b.tipo === 'Liquidacion');

    return (
        <div style={{ fontFamily: font }}>
            <PageHeader
                title="Beneficios sociales"
                subtitle="Gratificaciones, CTS y liquidaciones por cese. El cálculo respeta el régimen de la empresa."
                action={<Btn icon="download" variant="outline" onClick={exportar}>Exportar CSV</Btn>}
            />

            <Tabs tabs={['Gratificaciones', 'CTS', 'Liquidaciones']} active={tab} onChange={setTab} />

            {/* Formulario de cálculo según pestaña */}
            <Card style={{ marginBottom: 24 }}>
                {tab === 'Gratificaciones' && (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <Field label="Semestre">
                            <Select value={gSem} onChange={setGSem} style={{ width: 200 }}>
                                <option value="Julio">Julio (Fiestas Patrias)</option>
                                <option value="Diciembre">Diciembre (Navidad)</option>
                            </Select>
                        </Field>
                        <Field label="Año">
                            <input style={{ ...inputStyle, width: 120 }} value={gAnio} onChange={(e) => setGAnio(e.target.value)} />
                        </Field>
                        <Btn icon="dollar" disabled={procesando} onClick={calcGrati}>
                            {procesando ? 'Calculando…' : 'Calcular gratificaciones'}
                        </Btn>
                    </div>
                )}
                {tab === 'CTS' && (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <Field label="Depósito">
                            <Select value={cPer} onChange={setCPer} style={{ width: 200 }}>
                                <option value="Mayo">Mayo (nov–abr)</option>
                                <option value="Noviembre">Noviembre (may–oct)</option>
                            </Select>
                        </Field>
                        <Field label="Año">
                            <input style={{ ...inputStyle, width: 120 }} value={cAnio} onChange={(e) => setCAnio(e.target.value)} />
                        </Field>
                        <Btn icon="dollar" disabled={procesando} onClick={calcCts}>
                            {procesando ? 'Calculando…' : 'Calcular CTS'}
                        </Btn>
                    </div>
                )}
                {tab === 'Liquidaciones' && (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <Field label="Empleado que cesa">
                            <Select value={lEmp} onChange={setLEmp} style={{ width: 240 }}>
                                <option value="">Selecciona…</option>
                                {empleados.map((e) => <option key={e.empleado_id} value={e.empleado_id}>{e.nombre || `#${e.empleado_id}`}</option>)}
                            </Select>
                        </Field>
                        <Field label="Fecha de cese">
                            <input type="date" style={{ ...inputStyle, width: 170 }} value={lFecha} onChange={(e) => setLFecha(e.target.value)} />
                        </Field>
                        <Field label="Días de vacaciones pendientes">
                            <input style={{ ...inputStyle, width: 120 }} value={lDias} onChange={(e) => setLDias(e.target.value)} />
                        </Field>
                        <Btn icon="dollar" disabled={procesando} onClick={calcLiq}>
                            {procesando ? 'Calculando…' : 'Calcular liquidación'}
                        </Btn>
                    </div>
                )}
            </Card>

            <Card>
                {filtrados.length === 0 ? (
                    <Empty text="Aún no hay cálculos para esta categoría." />
                ) : (
                    <table style={tableStyles.table as React.CSSProperties}>
                        <thead><tr>
                            <th style={tableStyles.th as React.CSSProperties}>Empleado</th>
                            <th style={tableStyles.th as React.CSSProperties}>Periodo</th>
                            <th style={tableStyles.th as React.CSSProperties}>Monto</th>
                            <th style={tableStyles.th as React.CSSProperties}>Estado</th>
                            <th style={tableStyles.th as React.CSSProperties}></th>
                        </tr></thead>
                        <tbody>
                            {filtrados.map((b) => (
                                <tr key={b.beneficio_id}>
                                    <td style={tableStyles.td as React.CSSProperties}>{b.empleado_nombre || `#${b.empleado_id}`}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>{b.periodo}</td>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), fontWeight: 700, color: colors.textStrong }}>{soles(b.monto)}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>
                                        <Badge tone={b.estado === 'Pagado' ? 'green' : 'orange'}>{b.estado}</Badge>
                                    </td>
                                    <td style={tableStyles.td as React.CSSProperties}>
                                        {b.estado !== 'Pagado' && (
                                            <Btn size="sm" variant="outline" onClick={() => marcarPagado(b.beneficio_id)}>Marcar pagado</Btn>
                                        )}
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
