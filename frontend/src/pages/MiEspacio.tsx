import React, { useEffect, useState } from 'react';
import { colors, font } from '../theme';
import api from '../services/api';
import { Card, PageHeader, Badge, KpiCard, Loading, Empty, tableStyles, Btn, useToast } from '../components/ui';

// ============================================================================
// Fase 1 — Portal de aterrizaje del rol Empleado (autogestión).
//
// Vista de solo lectura de los datos propios del trabajador. El backend ya cierra
// el IDOR: /empleados/contratos/{id} solo devuelve datos si coinciden con el
// empleado autenticado. Los formularios de autogestión (vacaciones, descansos
// médicos, firma de boleta con PIN) llegan en fases posteriores.
// ============================================================================

interface Perfil {
    usuario_id: number;
    nombre: string;
    correo: string;
    rol: string;
    empresa_id: number;
    empleado_id: number | null;
    jefe_id: number | null;
}

interface Contrato {
    contrato_id: number;
    empleado_id: number;
    tipo_contrato: string;
    sueldo_base: number;
    horas_contrato_mes: number;
    fecha_inicio: string;
    fecha_fin: string | null;
    estado: string;
}

const soles = (n: number | string) =>
    'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MiEspacio() {
    const toast = useToast();
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [contratos, setContratos] = useState<Contrato[]>([]);
    const [marcaciones, setMarcaciones] = useState<any[]>([]);
    const [marcando, setMarcando] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargarMarcaciones = async (empleadoId: number) => {
        try {
            const res = await api.get('/asistencia/marcaciones', { params: { empleado_id: empleadoId } });
            setMarcaciones(Array.isArray(res.data) ? res.data : []);
        } catch { setMarcaciones([]); }
    };

    useEffect(() => {
        (async () => {
            try {
                const me = await api.get('/core/usuarios/me');
                const p: Perfil = me.data;
                setPerfil(p);
                if (p.empleado_id) {
                    const res = await api.get(`/empleados/contratos/${p.empleado_id}`);
                    setContratos(res.data);
                    cargarMarcaciones(p.empleado_id);
                }
            } catch (e: any) {
                setError(e?.response?.data?.detail || 'No se pudieron cargar tus datos.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const marcarRemoto = async () => {
        if (!perfil?.empleado_id) return;
        setMarcando(true);
        const enviar = async (lat?: number, lng?: number) => {
            try {
                const res = await api.post('/asistencia/marcar-remoto', { lat, lng });
                toast('success', `Marcación de ${res.data.tipo} registrada.`);
                cargarMarcaciones(perfil.empleado_id!);
            } catch (e: any) {
                toast('error', e?.response?.data?.detail || 'No se pudo registrar la marcación.');
            } finally { setMarcando(false); }
        };
        // GPS opcional: si el usuario lo permite, se adjunta; si no, se marca igual con IP.
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => enviar(pos.coords.latitude, pos.coords.longitude),
                () => enviar(undefined, undefined),
                { timeout: 4000 },
            );
        } else {
            enviar();
        }
    };

    if (loading) return <Loading text="Cargando tu información…" />;
    if (error) return <div style={{ padding: 24, color: colors.red, fontFamily: font }}>{error}</div>;

    const contratoVigente = contratos.find((c) => c.estado === 'Vigente');

    return (
        <div style={{ fontFamily: font }}>
            <PageHeader
                title={`Hola, ${perfil?.nombre || 'colaborador'}`}
                subtitle="Este es tu espacio personal. Consulta tus datos, contratos y boletas."
            />

            {/* Aviso si el usuario no tiene ficha de empleado asociada */}
            {perfil && !perfil.empleado_id && (
                <Card style={{ marginBottom: 24 }}>
                    <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>
                        Tu cuenta aún no tiene un perfil de empleado vinculado. Contacta con RRHH
                        para completar tu registro.
                    </p>
                </Card>
            )}

            {/* KPIs del contrato vigente */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
                <KpiCard
                    label="Contrato vigente"
                    value={contratoVigente ? contratoVigente.tipo_contrato : '—'}
                    icon="file"
                    badge={contratoVigente ? 'Activo' : undefined}
                    badgeTone="green"
                />
                <KpiCard
                    label="Remuneración base"
                    value={contratoVigente ? soles(contratoVigente.sueldo_base) : '—'}
                    icon="dollar"
                />
                <KpiCard
                    label="Jornada mensual"
                    value={contratoVigente ? `${contratoVigente.horas_contrato_mes} h` : '—'}
                    icon="clock"
                />
            </div>

            {/* Datos personales */}
            <Card style={{ marginBottom: 28 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>
                    Mis datos
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    <Dato label="Nombre" valor={perfil?.nombre || '—'} />
                    <Dato label="Correo" valor={perfil?.correo || '—'} />
                    <Dato label="Rol" valor={perfil?.rol || '—'} />
                    <Dato label="ID de empleado" valor={perfil?.empleado_id ? `#${perfil.empleado_id}` : '—'} />
                </div>
            </Card>

            {/* Marcación remota (teletrabajo / campo) */}
            {perfil?.empleado_id && (
                <Card style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                        <div>
                            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Marcación remota</h3>
                            <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>Para teletrabajo o labores de campo. Se valida con tu ubicación (GPS) e IP.</p>
                        </div>
                        <Btn icon="clock" disabled={marcando} onClick={marcarRemoto}>{marcando ? 'Registrando…' : 'Marcar entrada / salida'}</Btn>
                    </div>
                    {marcaciones.length === 0 ? (
                        <Empty text="Aún no tienes marcaciones registradas." />
                    ) : (
                        <table style={tableStyles.table as React.CSSProperties}>
                            <thead><tr>
                                <th style={tableStyles.th as React.CSSProperties}>Fecha y hora</th>
                                <th style={tableStyles.th as React.CSSProperties}>Tipo</th>
                                <th style={tableStyles.th as React.CSSProperties}>Origen</th>
                                <th style={tableStyles.th as React.CSSProperties}>Ubicación</th>
                            </tr></thead>
                            <tbody>
                                {marcaciones.slice(0, 12).map((m) => (
                                    <tr key={m.marcacion_id}>
                                        <td style={tableStyles.td as React.CSSProperties}>{new Date(m.momento).toLocaleString('es-PE')}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>
                                            <Badge tone={m.tipo === 'entrada' ? 'green' : 'orange'}>{m.tipo}</Badge>
                                        </td>
                                        <td style={tableStyles.td as React.CSSProperties}>{m.origen}</td>
                                        <td style={{ ...(tableStyles.td as React.CSSProperties), color: colors.textMuted, fontSize: 12 }}>
                                            {m.lat != null && m.lng != null ? `${Number(m.lat).toFixed(4)}, ${Number(m.lng).toFixed(4)}` : (m.ip || '—')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            )}

            {/* Historial de contratos (solo lectura) */}
            <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>
                    Mis contratos
                </h3>
                {contratos.length === 0 ? (
                    <Empty text="Aún no tienes contratos registrados." />
                ) : (
                    <table style={tableStyles.table as React.CSSProperties}>
                        <thead>
                            <tr>
                                <th style={tableStyles.th as React.CSSProperties}>Tipo</th>
                                <th style={tableStyles.th as React.CSSProperties}>Sueldo base</th>
                                <th style={tableStyles.th as React.CSSProperties}>Inicio</th>
                                <th style={tableStyles.th as React.CSSProperties}>Fin</th>
                                <th style={tableStyles.th as React.CSSProperties}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contratos.map((c) => (
                                <tr key={c.contrato_id}>
                                    <td style={tableStyles.td as React.CSSProperties}>{c.tipo_contrato}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>{soles(c.sueldo_base)}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>{c.fecha_inicio}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>{c.fecha_fin || 'Indefinido'}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>
                                        <Badge tone={c.estado === 'Vigente' ? 'green' : 'gray'}>{c.estado}</Badge>
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

function Dato({ label, valor }: { label: string; valor: string }) {
    return (
        <div>
            <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: colors.textStrong }}>{valor}</p>
        </div>
    );
}
