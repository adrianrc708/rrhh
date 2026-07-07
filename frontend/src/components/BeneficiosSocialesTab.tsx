import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors } from '../theme';
import { Card, Field, Select, Btn, Badge, Loading, Empty, tableStyles, useToast } from './ui';

interface Beneficio {
    id: number;
    empleado_id: number;
    nombre_empleado: string;
    tipo: string;
    periodo: string;
    meses_computados: number;
    monto_bruto: number;
    bonificacion_extraordinaria: number;
    aporte_pension: number;
    monto_neto: number;
    estado: string;
}

const money = (n: number) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MESES_GRATIFICACION = [{ v: '07', l: 'Julio (Fiestas Patrias)' }, { v: '12', l: 'Diciembre (Navidad)' }];
const MESES_CTS = [{ v: '05', l: 'Mayo' }, { v: '11', l: 'Noviembre' }];

export default function BeneficiosSocialesTab() {
    const toast = useToast();
    const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
    const [cargando, setCargando] = useState(true);
    const [generando, setGenerando] = useState(false);
    const [procesando, setProcesando] = useState<number | null>(null);

    const [tipo, setTipo] = useState<'Gratificacion' | 'CTS'>('Gratificacion');
    const [anio, setAnio] = useState(String(new Date().getFullYear()));
    const [mes, setMes] = useState('07');

    const cargar = async () => {
        try {
            setCargando(true);
            const res = await api.get('/beneficios/');
            setBeneficios(res.data);
        } catch (err) {
            console.error('Error al cargar beneficios sociales:', err);
        } finally { setCargando(false); }
    };

    useEffect(() => { cargar(); }, []);

    const cambiarTipo = (t: 'Gratificacion' | 'CTS') => {
        setTipo(t);
        setMes(t === 'Gratificacion' ? '07' : '05');
    };

    const generar = async () => {
        setGenerando(true);
        const periodo = `${anio}-${mes}`;
        const endpoint = tipo === 'Gratificacion' ? '/beneficios/gratificacion/generar' : '/beneficios/cts/generar';
        try {
            const res = await api.post(endpoint, { periodo });
            toast('success', `${tipo === 'Gratificacion' ? 'Gratificación' : 'CTS'} generada para ${res.data.length} colaborador(es).`);
            cargar();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo generar el beneficio.');
        } finally { setGenerando(false); }
    };

    const marcarPagado = async (id: number) => {
        setProcesando(id);
        try {
            await api.patch(`/beneficios/${id}/marcar-pagado`);
            toast('success', 'Beneficio marcado como pagado.');
            cargar();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo actualizar el estado.');
        } finally { setProcesando(null); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card>
                <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Generar beneficio social</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted }}>
                    Calcula automáticamente la gratificación o la CTS de todos los colaboradores activos con contrato vigente.
                </p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ width: 180 }}>
                        <Field label="Beneficio">
                            <Select value={tipo} onChange={(v) => cambiarTipo(v as 'Gratificacion' | 'CTS')}>
                                <option value="Gratificacion">Gratificación</option>
                                <option value="CTS">CTS</option>
                            </Select>
                        </Field>
                    </div>
                    <div style={{ width: 200 }}>
                        <Field label="Periodo">
                            <Select value={mes} onChange={setMes}>
                                {(tipo === 'Gratificacion' ? MESES_GRATIFICACION : MESES_CTS).map((m) => (
                                    <option key={m.v} value={m.v}>{m.l}</option>
                                ))}
                            </Select>
                        </Field>
                    </div>
                    <div style={{ width: 110 }}>
                        <Field label="Año">
                            <input type="number" value={anio} onChange={(e) => setAnio(e.target.value)}
                                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 14, width: '100%', boxSizing: 'border-box' }} />
                        </Field>
                    </div>
                    <Btn icon="plus" onClick={generar} disabled={generando}>{generando ? 'Generando…' : 'Generar'}</Btn>
                </div>
            </Card>

            <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Historial de beneficios sociales</h3>
                {cargando ? <Loading /> : beneficios.length === 0 ? <Empty text="Aún no se han generado beneficios sociales." /> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={tableStyles.table}>
                            <thead><tr>
                                <th style={tableStyles.th}>Colaborador</th>
                                <th style={tableStyles.th}>Beneficio</th>
                                <th style={tableStyles.th}>Periodo</th>
                                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Meses</th>
                                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Monto neto</th>
                                <th style={tableStyles.th}>Estado</th>
                                <th style={{ ...tableStyles.th, textAlign: 'right' }}></th>
                            </tr></thead>
                            <tbody>
                                {beneficios.map((b) => (
                                    <tr key={`${b.tipo}-${b.id}`}>
                                        <td style={{ ...tableStyles.td, fontWeight: 600, color: colors.textStrong }}>{b.nombre_empleado}</td>
                                        <td style={tableStyles.td}><Badge tone={b.tipo === 'Gratificacion' ? 'purple' : 'blue'}>{b.tipo}</Badge></td>
                                        <td style={{ ...tableStyles.td, color: colors.textMuted }}>{b.periodo}</td>
                                        <td style={{ ...tableStyles.td, textAlign: 'right' }}>{b.meses_computados}</td>
                                        <td style={{ ...tableStyles.td, textAlign: 'right', fontWeight: 700, color: colors.textStrong }}>{money(b.monto_neto)}</td>
                                        <td style={tableStyles.td}><Badge tone={b.estado === 'Pagado' ? 'green' : 'amber'}>{b.estado}</Badge></td>
                                        <td style={{ ...tableStyles.td, textAlign: 'right' }}>
                                            {b.estado !== 'Pagado' && (
                                                <Btn size="sm" variant="green" disabled={procesando === b.id} onClick={() => marcarPagado(b.id)}>Marcar pagado</Btn>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
