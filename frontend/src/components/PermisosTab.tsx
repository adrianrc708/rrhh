import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { colors, radius } from '../theme';
import { Card, Btn, Loading, Empty, tableStyles, inputStyle, Field, Select, useToast, Badge } from './ui';

const TIPOS_PERMISO = ['Justificada', 'Permiso_sin_goce', 'Permiso_con_goce', 'Licencia'];

interface SolicitudAutogestion {
    solicitud_id: number;
    empleado_id: number;
    nombre_empleado: string;
    tipo: string;
    fecha: string;
    horas: number;
    observaciones: string | null;
    documento_nombre: string | null;
    estado: string;
}

function SolicitudesAutogestion() {
    const toast = useToast();
    const [pendientes, setPendientes] = useState<SolicitudAutogestion[]>([]);
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState<number | null>(null);

    const cargar = async () => {
        try {
            setCargando(true);
            const res = await api.get('/permisos/pendientes');
            setPendientes(res.data);
        } catch (err) {
            console.error('Error al cargar solicitudes de autogestión:', err);
        } finally { setCargando(false); }
    };

    useEffect(() => { cargar(); }, []);

    const descargarDocumento = async (solicitudId: number, nombre: string) => {
        try {
            const res = await api.get(`/permisos/${solicitudId}/documento`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url; a.download = nombre;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            toast('error', 'No se pudo descargar el documento.');
        }
    };

    const aprobar = async (id: number) => {
        setProcesando(id);
        try {
            await api.patch(`/permisos/${id}/aprobar`);
            toast('success', 'Solicitud aprobada. Se registró como inasistencia.');
            cargar();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo aprobar la solicitud.');
        } finally { setProcesando(null); }
    };

    const rechazar = async (id: number) => {
        const motivo = window.prompt('Motivo del rechazo (opcional):') || undefined;
        setProcesando(id);
        try {
            await api.patch(`/permisos/${id}/rechazar`, { motivo });
            toast('success', 'Solicitud rechazada.');
            cargar();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo rechazar la solicitud.');
        } finally { setProcesando(null); }
    };

    if (cargando) return <Card><Loading text="Cargando solicitudes de autogestión…" /></Card>;

    return (
        <Card style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Solicitudes de autogestión pendientes</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted }}>
                Permisos y descansos médicos que los colaboradores solicitaron desde Mi Espacio.
            </p>
            {pendientes.length === 0 ? <Empty text="No hay solicitudes de autogestión pendientes." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pendientes.map((s) => (
                        <div key={s.solicitud_id} style={{ padding: 14, background: colors.bg, borderRadius: radius.md, border: `1px solid ${colors.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                                <div>
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.textStrong }}>
                                        {s.nombre_empleado} · <Badge tone="blue">{s.tipo.replace(/_/g, ' ')}</Badge>
                                    </p>
                                    <p style={{ margin: '4px 0 0', fontSize: 12.5, color: colors.textMuted }}>{s.fecha} · {s.horas} h{s.observaciones ? ` · ${s.observaciones}` : ''}</p>
                                    {s.documento_nombre && (
                                        <button onClick={() => descargarDocumento(s.solicitud_id, s.documento_nombre!)} style={{ marginTop: 6, background: 'none', border: 'none', color: colors.blueText, fontSize: 12.5, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                                            Ver documento adjunto: {s.documento_nombre}
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Btn size="sm" variant="danger" disabled={procesando === s.solicitud_id} onClick={() => rechazar(s.solicitud_id)}>Rechazar</Btn>
                                    <Btn size="sm" variant="green" disabled={procesando === s.solicitud_id} onClick={() => aprobar(s.solicitud_id)}>Aprobar</Btn>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}

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
        <div>
            <SolicitudesAutogestion />

            <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 2fr' }}>
                <Card>
                    <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Registrar Permiso Directamente</h3>
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
        </div>
    );
}
