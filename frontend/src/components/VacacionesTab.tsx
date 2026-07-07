import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors, radius } from '../theme';
import { Card, Btn, Loading, Empty, tableStyles, useToast, Badge } from './ui';

interface Saldo {
    empleado_id: number;
    nombre: string;
    dias_devengados: number;
    dias_comprometidos: number;
    dias_disponibles: number;
}

interface Solicitud {
    solicitud_id: number;
    empleado_id: number;
    nombre_empleado: string;
    fecha_inicio: string;
    fecha_fin: string;
    dias_solicitados: number;
    estado: string;
}

export default function VacacionesTab() {
    const toast = useToast();
    const [pendientes, setPendientes] = useState<Solicitud[]>([]);
    const [equipo, setEquipo] = useState<Saldo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState<number | null>(null);

    const cargar = async () => {
        try {
            setCargando(true);
            const [resPend, resEquipo] = await Promise.all([
                api.get('/vacaciones/pendientes'),
                api.get('/vacaciones/equipo'),
            ]);
            setPendientes(resPend.data);
            setEquipo(resEquipo.data);
        } catch (err) {
            console.error('Error al cargar vacaciones:', err);
        } finally { setCargando(false); }
    };

    useEffect(() => { cargar(); }, []);

    const aprobar = async (id: number) => {
        setProcesando(id);
        try {
            await api.patch(`/vacaciones/solicitudes/${id}/aprobar`);
            toast('success', 'Solicitud de vacaciones aprobada.');
            cargar();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo aprobar la solicitud.');
        } finally { setProcesando(null); }
    };

    const rechazar = async (id: number) => {
        const motivo = window.prompt('Motivo del rechazo (opcional):') || undefined;
        setProcesando(id);
        try {
            await api.patch(`/vacaciones/solicitudes/${id}/rechazar`, { motivo });
            toast('success', 'Solicitud de vacaciones rechazada.');
            cargar();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo rechazar la solicitud.');
        } finally { setProcesando(null); }
    };

    if (cargando) return <Loading text="Cargando vacaciones del equipo…" />;

    return (
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1.3fr 1fr' }}>
            <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Solicitudes pendientes</h3>
                {pendientes.length === 0 ? <Empty text="No hay solicitudes de vacaciones pendientes." /> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {pendientes.map((s) => (
                            <div key={s.solicitud_id} style={{ padding: 14, background: colors.bg, borderRadius: radius.md, border: `1px solid ${colors.border}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.textStrong }}>{s.nombre_empleado}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: colors.textMuted }}>{s.fecha_inicio} al {s.fecha_fin} · {s.dias_solicitados} días</p>
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

            <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Saldo del equipo</h3>
                {equipo.length === 0 ? <Empty text="No hay colaboradores en tu alcance." /> : (
                    <table style={tableStyles.table}>
                        <thead><tr>
                            <th style={tableStyles.th}>Colaborador</th>
                            <th style={{ ...tableStyles.th, textAlign: 'right' }}>Disponibles</th>
                        </tr></thead>
                        <tbody>
                            {equipo.map((e) => (
                                <tr key={e.empleado_id}>
                                    <td style={{ ...tableStyles.td, fontWeight: 600, color: colors.textStrong }}>{e.nombre}</td>
                                    <td style={{ ...tableStyles.td, textAlign: 'right' }}>
                                        <Badge tone={e.dias_disponibles > 0 ? 'green' : 'gray'}>{e.dias_disponibles} días</Badge>
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
