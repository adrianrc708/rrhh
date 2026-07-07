import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors, font } from '../theme';
import { Card, Btn, Badge, Field, Select, Loading, Empty, tableStyles, inputStyle, useToast } from './ui';

// Fase 3 — Jornadas atípicas cíclicas (ej. 14x7). Un ciclo activo por empleado.
export default function JornadasTab({ empleados }: { empleados: any[] }) {
    const toast = useToast();
    const [ciclos, setCiclos] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);

    const [empleadoSel, setEmpleadoSel] = useState('');
    const [nombre, setNombre] = useState('14x7');
    const [diasTrabajo, setDiasTrabajo] = useState('14');
    const [diasDescanso, setDiasDescanso] = useState('7');
    const [inicio, setInicio] = useState('');

    const cargar = async () => {
        try { const r = await api.get('/asistencia/ciclos'); setCiclos(r.data); }
        catch (e) { console.error(e); } finally { setCargando(false); }
    };
    useEffect(() => { cargar(); }, []);

    const nombreEmpleado = (id: number) => empleados.find((e) => e.empleado_id === id)?.nombre || `ID ${id}`;

    const crear = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empleadoSel || !inicio) { toast('warning', 'Completa colaborador y fecha de inicio.'); return; }
        try {
            await api.post('/asistencia/ciclos', {
                empleado_id: Number(empleadoSel),
                nombre,
                dias_trabajo: Number(diasTrabajo),
                dias_descanso: Number(diasDescanso),
                fecha_inicio_ciclo: inicio,
            });
            toast('success', 'Jornada atípica asignada.');
            setEmpleadoSel(''); setInicio('');
            cargar();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo asignar la jornada.');
        }
    };

    const eliminar = async (id: number) => {
        if (!window.confirm('¿Quitar esta jornada atípica?')) return;
        try { await api.delete(`/asistencia/ciclos/${id}`); toast('success', 'Jornada eliminada.'); cargar(); }
        catch (e: any) { toast('error', 'Error: ' + (e.response?.data?.detail || e.message)); }
    };

    return (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', fontFamily: font }}>
            <Card style={{ width: 320, flexShrink: 0 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Asignar jornada atípica</h3>
                <p style={{ margin: '0 0 14px', fontSize: 12.5, color: colors.textMuted }}>Ej. 14x7: 14 días de trabajo y 7 de descanso. El trabajo en descanso cuenta como sobretiempo.</p>
                <form onSubmit={crear} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Field label="Colaborador">
                        <Select value={empleadoSel} onChange={setEmpleadoSel} required>
                            <option value="">— Seleccionar —</option>
                            {empleados.map((e) => <option key={e.empleado_id} value={e.empleado_id}>{e.nombre || `ID ${e.empleado_id}`}</option>)}
                        </Select>
                    </Field>
                    <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} /></Field>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <Field label="Días trabajo"><input type="number" min="1" value={diasTrabajo} onChange={(e) => setDiasTrabajo(e.target.value)} style={inputStyle} /></Field>
                        <Field label="Días descanso"><input type="number" min="0" value={diasDescanso} onChange={(e) => setDiasDescanso(e.target.value)} style={inputStyle} /></Field>
                    </div>
                    <Field label="Inicio del ciclo"><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} style={inputStyle} required /></Field>
                    <Btn type="submit" icon="plus" style={{ width: '100%', justifyContent: 'center' }}>Asignar</Btn>
                </form>
            </Card>

            <Card style={{ flex: 1, minWidth: 320 }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Jornadas activas</h3>
                {cargando ? <Loading /> : ciclos.length === 0 ? <Empty text="Sin jornadas atípicas asignadas." /> : (
                    <table style={tableStyles.table as React.CSSProperties}>
                        <thead><tr>
                            <th style={tableStyles.th as React.CSSProperties}>Colaborador</th>
                            <th style={tableStyles.th as React.CSSProperties}>Ciclo</th>
                            <th style={tableStyles.th as React.CSSProperties}>Inicio</th>
                            <th style={{ ...(tableStyles.th as React.CSSProperties), textAlign: 'center' }}></th>
                        </tr></thead>
                        <tbody>
                            {ciclos.map((c) => (
                                <tr key={c.ciclo_id}>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), fontWeight: 600, color: colors.textStrong }}>{nombreEmpleado(c.empleado_id)}</td>
                                    <td style={tableStyles.td as React.CSSProperties}><Badge tone="purple">{c.nombre}</Badge> <span style={{ color: colors.textMuted, fontSize: 12 }}>{c.dias_trabajo}x{c.dias_descanso}</span></td>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), color: colors.textMuted }}>{c.fecha_inicio_ciclo}</td>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'center' }}>
                                        <Btn size="sm" variant="danger" icon="trash" onClick={() => eliminar(c.ciclo_id)}>Quitar</Btn>
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
