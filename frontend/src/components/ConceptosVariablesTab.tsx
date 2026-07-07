import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors } from '../theme';
import { Card, Field, Select, Btn, Badge, Loading, Empty, tableStyles, inputStyle, useToast } from './ui';

interface Concepto {
    id: number;
    empleado_id: number;
    nombre_empleado: string;
    tipo: string;
    periodo: string;
    monto: number;
    cuotas: number;
    descripcion: string | null;
    estado: string;
}

const money = (n: number) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TIPO_TONE: Record<string, any> = { Comision: 'green', Adelanto: 'amber', Prestamo: 'blue' };

export default function ConceptosVariablesTab() {
    const toast = useToast();
    const [empleados, setEmpleados] = useState<any[]>([]);
    const [conceptos, setConceptos] = useState<Concepto[]>([]);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [procesando, setProcesando] = useState<number | null>(null);

    const [empleadoId, setEmpleadoId] = useState('');
    const [tipo, setTipo] = useState('Comision');
    const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
    const [monto, setMonto] = useState('');
    const [cuotas, setCuotas] = useState('1');
    const [descripcion, setDescripcion] = useState('');

    const cargar = async () => {
        try {
            setCargando(true);
            const [resEmp, resConceptos] = await Promise.all([
                api.get('/empleados/'),
                api.get('/conceptos/'),
            ]);
            setEmpleados(Array.isArray(resEmp.data) ? resEmp.data : []);
            setConceptos(resConceptos.data);
        } catch (err) {
            console.error('Error al cargar conceptos variables:', err);
        } finally { setCargando(false); }
    };

    useEffect(() => { cargar(); }, []);

    const registrar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empleadoId || !monto) { toast('warning', 'Selecciona un colaborador e ingresa el monto.'); return; }
        setGuardando(true);
        try {
            await api.post('/conceptos/', {
                empleado_id: Number(empleadoId), tipo, periodo, monto: Number(monto),
                cuotas: tipo === 'Prestamo' ? Number(cuotas) : 1,
                descripcion: descripcion || null,
            });
            toast('success', `${tipo} registrado correctamente.`);
            setMonto(''); setDescripcion(''); setCuotas('1');
            cargar();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo registrar el concepto.');
        } finally { setGuardando(false); }
    };

    const cancelar = async (id: number) => {
        if (!window.confirm('¿Cancelar este concepto? Se detendrán las cuotas pendientes.')) return;
        setProcesando(id);
        try {
            await api.patch(`/conceptos/${id}/cancelar`);
            toast('success', 'Concepto cancelado.');
            cargar();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo cancelar el concepto.');
        } finally { setProcesando(null); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card>
                <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Registrar concepto variable</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted }}>
                    Las comisiones se abonan íntegras en el periodo indicado. Los adelantos y préstamos se descuentan de la planilla en las cuotas que definas.
                </p>
                <form onSubmit={registrar} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ width: 220 }}>
                        <Field label="Colaborador">
                            <Select value={empleadoId} onChange={setEmpleadoId}>
                                <option value="">-- Seleccionar --</option>
                                {empleados.map((e) => <option key={e.empleado_id} value={e.empleado_id}>{e.nombre || `ID ${e.empleado_id}`}</option>)}
                            </Select>
                        </Field>
                    </div>
                    <div style={{ width: 150 }}>
                        <Field label="Tipo">
                            <Select value={tipo} onChange={setTipo}>
                                <option value="Comision">Comisión</option>
                                <option value="Adelanto">Adelanto</option>
                                <option value="Prestamo">Préstamo</option>
                            </Select>
                        </Field>
                    </div>
                    <div style={{ width: 150 }}>
                        <Field label="Periodo">
                            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={inputStyle} />
                        </Field>
                    </div>
                    <div style={{ width: 130 }}>
                        <Field label="Monto (S/.)">
                            <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} style={inputStyle} />
                        </Field>
                    </div>
                    {tipo === 'Prestamo' && (
                        <div style={{ width: 100 }}>
                            <Field label="Cuotas">
                                <input type="number" min="1" max="24" value={cuotas} onChange={(e) => setCuotas(e.target.value)} style={inputStyle} />
                            </Field>
                        </div>
                    )}
                    <div style={{ flex: '1 1 200px' }}>
                        <Field label="Descripción (opcional)">
                            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={inputStyle} placeholder="Ej. Comisión ventas junio" />
                        </Field>
                    </div>
                    <Btn icon="plus" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar'}</Btn>
                </form>
            </Card>

            <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Historial</h3>
                {cargando ? <Loading /> : conceptos.length === 0 ? <Empty text="Aún no se han registrado conceptos variables." /> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={tableStyles.table}>
                            <thead><tr>
                                <th style={tableStyles.th}>Colaborador</th>
                                <th style={tableStyles.th}>Tipo</th>
                                <th style={tableStyles.th}>Periodo</th>
                                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Monto</th>
                                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Cuotas</th>
                                <th style={tableStyles.th}>Estado</th>
                                <th style={{ ...tableStyles.th, textAlign: 'right' }}></th>
                            </tr></thead>
                            <tbody>
                                {conceptos.map((c) => (
                                    <tr key={c.id}>
                                        <td style={{ ...tableStyles.td, fontWeight: 600, color: colors.textStrong }}>{c.nombre_empleado}</td>
                                        <td style={tableStyles.td}><Badge tone={TIPO_TONE[c.tipo] || 'gray'}>{c.tipo}</Badge></td>
                                        <td style={{ ...tableStyles.td, color: colors.textMuted }}>{c.periodo}</td>
                                        <td style={{ ...tableStyles.td, textAlign: 'right', fontWeight: 700 }}>{money(c.monto)}</td>
                                        <td style={{ ...tableStyles.td, textAlign: 'right' }}>{c.cuotas}</td>
                                        <td style={tableStyles.td}><Badge tone={c.estado === 'Activo' ? 'green' : 'gray'}>{c.estado}</Badge></td>
                                        <td style={{ ...tableStyles.td, textAlign: 'right' }}>
                                            {c.estado === 'Activo' && (
                                                <Btn size="sm" variant="danger" disabled={procesando === c.id} onClick={() => cancelar(c.id)}>Cancelar</Btn>
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
