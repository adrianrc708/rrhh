import React, { useState } from 'react';
import api from '../services/api';
import { colors, font } from '../theme';
import { Card, Btn, Badge, Field, Loading, Empty, tableStyles, inputStyle, useToast } from './ui';

// Fase 3 — Conciliación y cierre mensual: segmenta horas desde marcaciones e
// inyecta el resultado en la nómina (HorasPeriodo) al congelar.
export default function ConciliacionTab() {
    const toast = useToast();
    const [periodo, setPeriodo] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [estado, setEstado] = useState<string>('');
    const [cargando, setCargando] = useState(false);
    const [cargado, setCargado] = useState(false);
    const [congelando, setCongelando] = useState(false);

    const previsualizar = async () => {
        if (!periodo) { toast('warning', 'Selecciona un periodo.'); return; }
        setCargando(true); setCargado(false);
        try {
            const r = await api.get('/asistencia/conciliacion', { params: { periodo } });
            setItems(r.data.items || []);
            setEstado(r.data.estado || 'Abierto');
            setCargado(true);
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo calcular la conciliación.');
        } finally { setCargando(false); }
    };

    const congelar = async () => {
        if (!window.confirm('Congelar la asistencia inyectará estas horas en la nómina del periodo. ¿Continuar?')) return;
        setCongelando(true);
        try {
            const r = await api.post('/asistencia/conciliacion/congelar', null, { params: { periodo } });
            toast('success', `Asistencia congelada: ${r.data.empleados_afectados} empleados inyectados a nómina.`);
            setEstado('Congelado');
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo congelar.');
        } finally { setCongelando(false); }
    };

    return (
        <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
                <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Conciliación y Cierre Mensual</h3>
                    <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>Segmenta las marcaciones del periodo (nocturnas / 25% / 35%) y las inyecta a nómina al congelar.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', fontFamily: font }}>
                    <Field label="Periodo"><input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ ...inputStyle, width: 170 }} /></Field>
                    <Btn variant="indigo" icon="refresh" onClick={previsualizar}>Calcular</Btn>
                    {cargado && estado !== 'Congelado' && items.length > 0 && (
                        <Btn variant="green" icon="check" disabled={congelando} onClick={congelar}>Congelar e inyectar</Btn>
                    )}
                </div>
            </div>

            {cargado && (
                <div style={{ marginBottom: 14 }}>
                    <Badge tone={estado === 'Congelado' ? 'green' : 'amber'}>{estado === 'Congelado' ? 'Periodo congelado' : 'Periodo abierto'}</Badge>
                </div>
            )}

            {cargando ? <Loading text="Calculando segmentación desde marcaciones…" /> :
                !cargado ? <Empty text="Elige un periodo y pulsa Calcular." /> :
                    items.length === 0 ? <Empty text="No hay empleados activos para el periodo." /> : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={tableStyles.table as React.CSSProperties}>
                                <thead><tr>
                                    <th style={tableStyles.th as React.CSSProperties}>Empleado</th>
                                    <th style={{ ...(tableStyles.th as React.CSSProperties), textAlign: 'right' }}>Marcaciones</th>
                                    <th style={{ ...(tableStyles.th as React.CSSProperties), textAlign: 'right' }}>Días</th>
                                    <th style={{ ...(tableStyles.th as React.CSSProperties), textAlign: 'right' }}>Horas tot.</th>
                                    <th style={{ ...(tableStyles.th as React.CSSProperties), textAlign: 'right' }}>Extra 25%</th>
                                    <th style={{ ...(tableStyles.th as React.CSSProperties), textAlign: 'right' }}>Extra 35%</th>
                                    <th style={{ ...(tableStyles.th as React.CSSProperties), textAlign: 'right' }}>Nocturnas</th>
                                    <th style={tableStyles.th as React.CSSProperties}>Jornada</th>
                                </tr></thead>
                                <tbody>
                                    {items.map((it) => (
                                        <tr key={it.empleado_id}>
                                            <td style={{ ...(tableStyles.td as React.CSSProperties), fontWeight: 600, color: colors.textStrong }}>{it.nombre}</td>
                                            <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'right' }}>{it.marcaciones}</td>
                                            <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'right' }}>{it.dias_trabajados}</td>
                                            <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'right' }}>{Number(it.horas_totales).toFixed(2)}</td>
                                            <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'right', color: colors.greenText }}>{Number(it.horas_extra_25).toFixed(2)}</td>
                                            <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'right', color: colors.greenText }}>{Number(it.horas_extra_35).toFixed(2)}</td>
                                            <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'right', color: colors.textBody }}>{Number(it.horas_nocturnas).toFixed(2)}</td>
                                            <td style={tableStyles.td as React.CSSProperties}>{it.jornada_ciclica ? <Badge tone="purple">{it.jornada_ciclica}</Badge> : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
        </Card>
    );
}
