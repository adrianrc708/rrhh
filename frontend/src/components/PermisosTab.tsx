import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { colors, radius } from '../theme';
import { Card, Btn, Loading, Empty, tableStyles, inputStyle, Field, Select, useToast, Badge } from './ui';

const TIPOS_PERMISO = ['Justificada', 'Permiso_sin_goce', 'Permiso_con_goce', 'Licencia'];

export default function PermisosTab({ empleados, inasistencias, refrescar }: { empleados: any[], inasistencias: any[], refrescar: () => void }) {
    const toast = useToast();
    const [empleadoId, setEmpleadoId] = useState('');
    const [fecha, setFecha] = useState('');
    const [tipo, setTipo] = useState('Justificada');
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
            toast('success', 'Permiso/Justificación registrado con éxito.');
            refrescar();
            setFecha(''); setObs('');
        } catch (err) {
            console.error('Error al registrar inasistencia:', err);
            toast('error', 'No se pudo registrar.');
        } finally { setGuardando(false); }
    };

    // Filter to only show the "justified" types as permissions
    const permisosRegistrados = inasistencias.filter(i => TIPOS_PERMISO.includes(i.tipo));

    return (
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 2fr' }}>
            <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Solicitar Permiso o Justificación</h3>
                <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Field label="Colaborador">
                        <Select value={empleadoId} onChange={setEmpleadoId} required>
                            <option value="">— Seleccionar —</option>
                            {empleados.map((e) => <option key={e.empleado_id} value={e.empleado_id}>{e.nombre || `ID ${e.empleado_id}`}</option>)}
                        </Select>
                    </Field>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} required /></Field>
                        <Field label="Horas"><input type="number" min="0" max="24" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} style={inputStyle} /></Field>
                    </div>
                    <Field label="Tipo">
                        <Select value={tipo} onChange={setTipo}>
                            {TIPOS_PERMISO.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                        </Select>
                    </Field>
                    <Field label="Motivo (Observaciones)">
                        <textarea value={obs} onChange={(e) => setObs(e.target.value)} style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} required />
                    </Field>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                        <Btn type="submit" variant="blue" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar Permiso'}</Btn>
                    </div>
                </form>
            </Card>

            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Estado de Solicitudes</h3>
                    <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>Mostrando registros del colaborador seleccionado en Inasistencias.</p>
                </div>
                {permisosRegistrados.length === 0 ? <Empty text="No hay permisos o justificaciones para el colaborador actual." /> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={tableStyles.table}>
                            <thead>
                                <tr>
                                    <th style={tableStyles.th}>Fecha</th>
                                    <th style={tableStyles.th}>Tipo</th>
                                    <th style={tableStyles.th}>Motivo</th>
                                    <th style={tableStyles.th}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {permisosRegistrados.map((p) => (
                                    <tr key={p.inasistencia_id}>
                                        <td style={{ ...tableStyles.td, fontWeight: 600 }}>{p.fecha}</td>
                                        <td style={tableStyles.td}>{p.tipo.replace(/_/g, ' ')}</td>
                                        <td style={{ ...tableStyles.td, color: colors.textMuted, maxWidth: 200 }}>{p.observaciones || '—'}</td>
                                        <td style={tableStyles.td}><Badge tone="green">Registrado</Badge></td>
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
