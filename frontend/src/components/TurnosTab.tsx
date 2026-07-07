import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { colors, radius, font } from '../theme';
import { Card, Btn, Loading, Empty, tableStyles, inputStyle, Field, Select, useToast } from './ui';

export default function TurnosTab({ empleados }: { empleados: any[] }) {
    const toast = useToast();
    const [turnos, setTurnos] = useState<any[]>([]);
    const [asignaciones, setAsignaciones] = useState<any[]>([]);
    const [cargando, setCargando] = useState(false);
    const [empleadoSel, setEmpleadoSel] = useState('');

    // Modal Crear Turno
    const [modalTurno, setModalTurno] = useState(false);
    const [nombreT, setNombreT] = useState('');
    const [entradaT, setEntradaT] = useState('');
    const [salidaT, setSalidaT] = useState('');

    // Formulario Asignación
    const [turnoId, setTurnoId] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [asignando, setAsignando] = useState(false);

    const cargarTurnos = async () => {
        try {
            const res = await api.get('/turnos/');
            setTurnos(res.data);
        } catch (e) {
            console.error(e);
            toast('error', 'Error al cargar turnos.');
        }
    };

    const cargarAsignaciones = async (id: string) => {
        if (!id) { setAsignaciones([]); return; }
        setCargando(true);
        try {
            const res = await api.get(`/turnos/asignaciones/empleado/${id}`);
            setAsignaciones(res.data);
        } catch (e) {
            console.error(e);
            toast('error', 'Error al cargar asignaciones.');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarTurnos();
    }, []);

    useEffect(() => {
        cargarAsignaciones(empleadoSel);
    }, [empleadoSel]);

    const crearTurno = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/turnos/', {
                nombre: nombreT,
                hora_entrada: entradaT,
                hora_salida: salidaT,
            });
            toast('success', 'Turno creado exitosamente.');
            setModalTurno(false);
            setNombreT(''); setEntradaT(''); setSalidaT('');
            cargarTurnos();
        } catch (err) {
            console.error(err);
            toast('error', 'No se pudo crear el turno.');
        }
    };

    const asignarTurno = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empleadoSel) { toast('warning', 'Selecciona un colaborador primero.'); return; }
        if (!turnoId || !fechaInicio) { toast('warning', 'Selecciona turno y fecha de inicio.'); return; }
        setAsignando(true);
        try {
            await api.post('/turnos/asignaciones', {
                empleado_id: Number(empleadoSel),
                turno_id: Number(turnoId),
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin || null,
            });
            toast('success', 'Turno asignado exitosamente.');
            cargarAsignaciones(empleadoSel);
            setTurnoId(''); setFechaInicio(''); setFechaFin('');
        } catch (err) {
            console.error(err);
            toast('error', 'No se pudo asignar el turno.');
        } finally {
            setAsignando(false);
        }
    };

    const eliminarTurno = async (id: number) => {
        if (!window.confirm('¿Eliminar este turno?')) return;
        try {
            await api.delete(`/turnos/${id}`);
            toast('success', 'Turno eliminado.');
            cargarTurnos();
        } catch (e) {
            console.error(e);
            toast('error', 'Error al eliminar el turno.');
        }
    }

    return (
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 2fr' }}>
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Turnos Creados</h3>
                    <Btn size="sm" icon="plus" onClick={() => setModalTurno(true)}>Nuevo Turno</Btn>
                </div>
                {turnos.length === 0 ? <Empty text="No hay turnos creados." /> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {turnos.map((t) => (
                            <div key={t.turno_id} style={{ padding: 12, border: `1px solid ${colors.border}`, borderRadius: radius.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600, color: colors.textStrong }}>{t.nombre}</div>
                                    <div style={{ fontSize: 13, color: colors.textMuted }}>{t.hora_entrada} - {t.hora_salida}</div>
                                </div>
                                <Btn size="sm" variant="danger" icon="trash" onClick={() => eliminarTurno(t.turno_id)}></Btn>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Asignación de Turnos</h3>
                <div style={{ marginBottom: 16 }}>
                    <Select value={empleadoSel} onChange={setEmpleadoSel} style={{ width: '100%', maxWidth: 300 }}>
                        <option value="">— Seleccionar colaborador —</option>
                        {empleados.map((e) => <option key={e.empleado_id} value={e.empleado_id}>{e.nombre || `ID ${e.empleado_id}`}</option>)}
                    </Select>
                </div>

                {empleadoSel && (
                    <div style={{ padding: 16, background: colors.bg, borderRadius: radius.md, marginBottom: 20 }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: colors.textStrong }}>Asignar nuevo turno</h4>
                        <form onSubmit={asignarTurno} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <Field label="Turno">
                                <Select value={turnoId} onChange={setTurnoId} required>
                                    <option value="">— Seleccionar —</option>
                                    {turnos.map((t) => <option key={t.turno_id} value={t.turno_id}>{t.nombre}</option>)}
                                </Select>
                            </Field>
                            <Field label="Fecha Inicio"><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} required /></Field>
                            <Field label="Fecha Fin (Opcional)"><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle} /></Field>
                            <Btn type="submit" disabled={asignando}>{asignando ? 'Asignando...' : 'Asignar'}</Btn>
                        </form>
                    </div>
                )}

                {!empleadoSel ? <Empty text="Selecciona un colaborador para ver sus turnos asignados." />
                    : cargando ? <Loading />
                        : asignaciones.length === 0 ? <Empty text="Este colaborador no tiene turnos asignados." />
                            : (
                                <table style={tableStyles.table}>
                                    <thead>
                                        <tr>
                                            <th style={tableStyles.th}>Turno</th>
                                            <th style={tableStyles.th}>Inicio</th>
                                            <th style={tableStyles.th}>Fin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {asignaciones.map((a) => (
                                            <tr key={a.asignacion_id}>
                                                <td style={tableStyles.td}>{turnos.find(t => t.turno_id === a.turno_id)?.nombre || `Turno ${a.turno_id}`}</td>
                                                <td style={tableStyles.td}>{a.fecha_inicio}</td>
                                                <td style={tableStyles.td}>{a.fecha_fin || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
            </Card>

            {modalTurno && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,19,40,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', borderRadius: radius.lg, padding: 28, width: 400, fontFamily: font, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700, color: colors.textStrong }}>Crear Turno</h3>
                        <form onSubmit={crearTurno} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <Field label="Nombre del Turno"><input type="text" value={nombreT} onChange={(e) => setNombreT(e.target.value)} style={inputStyle} placeholder="Ej. Mañana" required /></Field>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <Field label="Hora de Entrada"><input type="time" value={entradaT} onChange={(e) => setEntradaT(e.target.value)} style={inputStyle} required /></Field>
                                <Field label="Hora de Salida"><input type="time" value={salidaT} onChange={(e) => setSalidaT(e.target.value)} style={inputStyle} required /></Field>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                                <Btn variant="outline" onClick={() => setModalTurno(false)}>Cancelar</Btn>
                                <Btn type="submit" variant="orange">Crear</Btn>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
