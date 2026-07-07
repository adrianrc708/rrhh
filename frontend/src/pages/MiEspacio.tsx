import React, { useEffect, useState } from 'react';
import { colors, font, radius } from '../theme';
import api from '../services/api';
import { Card, PageHeader, Badge, KpiCard, Loading, Empty, tableStyles, Btn, Field, inputStyle, Select, useToast } from '../components/ui';

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

interface SaldoVacacional {
    dias_devengados: number;
    dias_comprometidos: number;
    dias_disponibles: number;
}

interface SolicitudVacaciones {
    solicitud_id: number;
    fecha_inicio: string;
    fecha_fin: string;
    dias_solicitados: number;
    estado: string;
    motivo_rechazo: string | null;
}

const ESTADO_VAC_TONE: Record<string, any> = { Pendiente: 'amber', Aprobada: 'green', Rechazada: 'red', Cancelada: 'gray' };

interface SolicitudPermiso {
    solicitud_id: number;
    tipo: string;
    fecha: string;
    horas: number;
    observaciones: string | null;
    documento_nombre: string | null;
    estado: string;
    motivo_rechazo: string | null;
}

const TIPOS_PERMISO_AUTOGESTION = [
    { v: 'Justificada', l: 'Justificada' },
    { v: 'Permiso_sin_goce', l: 'Permiso sin goce de haber' },
    { v: 'Permiso_con_goce', l: 'Permiso con goce de haber' },
    { v: 'Licencia', l: 'Licencia (descanso médico)' },
];

interface Beneficio {
    id: number;
    tipo: string;
    periodo: string;
    monto_neto: number;
    estado: string;
}

interface Concepto {
    id: number;
    tipo: string;
    periodo: string;
    monto: number;
    cuotas: number;
    estado: string;
}

const TIPO_CONCEPTO_TONE: Record<string, any> = { Comision: 'green', Adelanto: 'amber', Prestamo: 'blue' };

interface EvaluacionDesempeno {
    id: number;
    periodo: string;
    puntaje_promedio: number;
    comentarios: string | null;
}

interface IncidenciaKardex {
    id: number;
    tipo: string;
    fecha: string;
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
    const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
    const [conceptos, setConceptos] = useState<Concepto[]>([]);
    const [evaluaciones, setEvaluaciones] = useState<EvaluacionDesempeno[]>([]);
    const [incidencias, setIncidencias] = useState<IncidenciaKardex[]>([]);

    // Fase 5 — Permisos y descansos médicos (autogestión con documento adjunto)
    const [misPermisos, setMisPermisos] = useState<SolicitudPermiso[]>([]);
    const [tipoPermiso, setTipoPermiso] = useState('Justificada');
    const [fechaPermiso, setFechaPermiso] = useState('');
    const [horasPermiso, setHorasPermiso] = useState('8');
    const [obsPermiso, setObsPermiso] = useState('');
    const [documentoPermiso, setDocumentoPermiso] = useState<File | null>(null);
    const [solicitandoPermiso, setSolicitandoPermiso] = useState(false);

    const cargarPermisos = async () => {
        try {
            const res = await api.get('/permisos/mis-solicitudes');
            setMisPermisos(res.data);
        } catch { setMisPermisos([]); }
    };

    const solicitarPermiso = async (e: React.FormEvent) => {
        e.preventDefault();
        setSolicitandoPermiso(true);
        try {
            const fd = new FormData();
            fd.append('tipo', tipoPermiso);
            fd.append('fecha', fechaPermiso);
            fd.append('horas', horasPermiso);
            if (obsPermiso) fd.append('observaciones', obsPermiso);
            if (documentoPermiso) fd.append('documento', documentoPermiso);
            await api.post('/permisos/solicitar', fd);
            toast('success', 'Solicitud enviada. Quedará pendiente de aprobación.');
            setFechaPermiso(''); setObsPermiso(''); setDocumentoPermiso(null);
            cargarPermisos();
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo enviar la solicitud.');
        } finally { setSolicitandoPermiso(false); }
    };

    const cancelarPermiso = async (id: number) => {
        try {
            await api.post(`/permisos/solicitudes/${id}/cancelar`);
            toast('success', 'Solicitud cancelada.');
            cargarPermisos();
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo cancelar la solicitud.');
        }
    };

    // Fase 5 — Vacaciones (autogestión)
    const [saldoVac, setSaldoVac] = useState<SaldoVacacional | null>(null);
    const [misSolicitudes, setMisSolicitudes] = useState<SolicitudVacaciones[]>([]);
    const [fechaInicioVac, setFechaInicioVac] = useState('');
    const [fechaFinVac, setFechaFinVac] = useState('');
    const [solicitandoVac, setSolicitandoVac] = useState(false);

    const cargarVacaciones = async () => {
        try {
            const [resSaldo, resSolicitudes] = await Promise.all([
                api.get('/vacaciones/mi-saldo'),
                api.get('/vacaciones/mis-solicitudes'),
            ]);
            setSaldoVac(resSaldo.data);
            setMisSolicitudes(resSolicitudes.data);
        } catch { /* el empleado puede no tener ficha aún; se ignora en silencio */ }
    };

    const solicitarVacaciones = async (e: React.FormEvent) => {
        e.preventDefault();
        setSolicitandoVac(true);
        try {
            await api.post('/vacaciones/solicitar', { fecha_inicio: fechaInicioVac, fecha_fin: fechaFinVac });
            toast('success', 'Solicitud de vacaciones enviada. Quedará pendiente de aprobación.');
            setFechaInicioVac(''); setFechaFinVac('');
            cargarVacaciones();
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo enviar la solicitud.');
        } finally { setSolicitandoVac(false); }
    };

    const cancelarSolicitudVac = async (id: number) => {
        try {
            await api.post(`/vacaciones/solicitudes/${id}/cancelar`);
            toast('success', 'Solicitud cancelada.');
            cargarVacaciones();
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo cancelar la solicitud.');
        }
    };

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
                    cargarVacaciones();
                    api.get('/beneficios/mis-beneficios').then((r) => setBeneficios(r.data)).catch(() => setBeneficios([]));
                    api.get('/conceptos/mis-conceptos').then((r) => setConceptos(r.data)).catch(() => setConceptos([]));
                    cargarPermisos();
                    api.get('/desempeno/mis-evaluaciones').then((r) => setEvaluaciones(r.data)).catch(() => setEvaluaciones([]));
                    api.get('/desempeno/mis-incidencias').then((r) => setIncidencias(r.data)).catch(() => setIncidencias([]));
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

            {/* Vacaciones (Fase 5): saldo, solicitud y seguimiento */}
            {perfil?.empleado_id && (
                <Card style={{ marginBottom: 28 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Mis vacaciones</h3>

                    {saldoVac && (
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                            <KpiCard label="Días devengados" value={String(saldoVac.dias_devengados)} icon="calendar" />
                            <KpiCard label="Días comprometidos" value={String(saldoVac.dias_comprometidos)} icon="clock" />
                            <KpiCard
                                label="Días disponibles"
                                value={String(saldoVac.dias_disponibles)}
                                icon="check"
                                badge={saldoVac.dias_disponibles > 0 ? 'Disponible' : undefined}
                                badgeTone="green"
                            />
                        </div>
                    )}

                    <form onSubmit={solicitarVacaciones} style={{
                        display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
                        marginBottom: 24, padding: 16, background: colors.bg, borderRadius: radius.md,
                    }}>
                        <div style={{ flex: '1 1 160px' }}>
                            <Field label="Desde">
                                <input type="date" value={fechaInicioVac} onChange={(e) => setFechaInicioVac(e.target.value)} style={inputStyle} required />
                            </Field>
                        </div>
                        <div style={{ flex: '1 1 160px' }}>
                            <Field label="Hasta">
                                <input type="date" value={fechaFinVac} onChange={(e) => setFechaFinVac(e.target.value)} style={inputStyle} required />
                            </Field>
                        </div>
                        <Btn type="submit" icon="plus" disabled={solicitandoVac}>{solicitandoVac ? 'Enviando…' : 'Solicitar vacaciones'}</Btn>
                        <p style={{ margin: 0, fontSize: 11.5, color: colors.textFaint, width: '100%' }}>
                            El descanso se fracciona en periodos mínimos de 7 días continuos.
                        </p>
                    </form>

                    {misSolicitudes.length === 0 ? (
                        <Empty text="Aún no has solicitado vacaciones." />
                    ) : (
                        <table style={tableStyles.table as React.CSSProperties}>
                            <thead><tr>
                                <th style={tableStyles.th as React.CSSProperties}>Desde</th>
                                <th style={tableStyles.th as React.CSSProperties}>Hasta</th>
                                <th style={tableStyles.th as React.CSSProperties}>Días</th>
                                <th style={tableStyles.th as React.CSSProperties}>Estado</th>
                                <th style={tableStyles.th as React.CSSProperties}></th>
                            </tr></thead>
                            <tbody>
                                {misSolicitudes.map((s) => (
                                    <tr key={s.solicitud_id}>
                                        <td style={tableStyles.td as React.CSSProperties}>{s.fecha_inicio}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>{s.fecha_fin}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>{s.dias_solicitados}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>
                                            <Badge tone={ESTADO_VAC_TONE[s.estado] || 'gray'}>{s.estado}</Badge>
                                            {s.estado === 'Rechazada' && s.motivo_rechazo && (
                                                <p style={{ margin: '4px 0 0', fontSize: 11, color: colors.textMuted }}>{s.motivo_rechazo}</p>
                                            )}
                                        </td>
                                        <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'right' }}>
                                            {s.estado === 'Pendiente' && (
                                                <Btn size="sm" variant="outline" onClick={() => cancelarSolicitudVac(s.solicitud_id)}>Cancelar</Btn>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            )}

            {/* Permisos y descansos médicos (Fase 5): autogestión con documento adjunto */}
            {perfil?.empleado_id && (
                <Card style={{ marginBottom: 28 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Permisos y descansos médicos</h3>

                    <form onSubmit={solicitarPermiso} style={{
                        display: 'flex', flexDirection: 'column', gap: 14,
                        marginBottom: 24, padding: 16, background: colors.bg, borderRadius: radius.md,
                    }}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 220px' }}>
                                <Field label="Tipo">
                                    <Select value={tipoPermiso} onChange={setTipoPermiso}>
                                        {TIPOS_PERMISO_AUTOGESTION.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                                    </Select>
                                </Field>
                            </div>
                            <div style={{ flex: '1 1 150px' }}>
                                <Field label="Fecha">
                                    <input type="date" value={fechaPermiso} onChange={(e) => setFechaPermiso(e.target.value)} style={inputStyle} required />
                                </Field>
                            </div>
                            <div style={{ flex: '1 1 100px' }}>
                                <Field label="Horas">
                                    <input type="number" min="0" max="24" step="0.5" value={horasPermiso} onChange={(e) => setHorasPermiso(e.target.value)} style={inputStyle} />
                                </Field>
                            </div>
                        </div>
                        <Field label="Observaciones (opcional)">
                            <textarea value={obsPermiso} onChange={(e) => setObsPermiso(e.target.value)} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} />
                        </Field>
                        <Field label="Documento adjunto (opcional — certificado médico, etc.)">
                            <input
                                type="file" accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setDocumentoPermiso(e.target.files?.[0] || null)}
                                style={{ fontSize: 13, color: colors.textBody }}
                            />
                        </Field>
                        <div>
                            <Btn type="submit" icon="plus" disabled={solicitandoPermiso}>{solicitandoPermiso ? 'Enviando…' : 'Enviar solicitud'}</Btn>
                        </div>
                    </form>

                    {misPermisos.length === 0 ? (
                        <Empty text="Aún no has solicitado permisos ni descansos médicos." />
                    ) : (
                        <table style={tableStyles.table as React.CSSProperties}>
                            <thead><tr>
                                <th style={tableStyles.th as React.CSSProperties}>Tipo</th>
                                <th style={tableStyles.th as React.CSSProperties}>Fecha</th>
                                <th style={tableStyles.th as React.CSSProperties}>Horas</th>
                                <th style={tableStyles.th as React.CSSProperties}>Estado</th>
                                <th style={tableStyles.th as React.CSSProperties}></th>
                            </tr></thead>
                            <tbody>
                                {misPermisos.map((p) => (
                                    <tr key={p.solicitud_id}>
                                        <td style={tableStyles.td as React.CSSProperties}>{p.tipo.replace(/_/g, ' ')}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>{p.fecha}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>{p.horas}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>
                                            <Badge tone={ESTADO_VAC_TONE[p.estado] || 'gray'}>{p.estado}</Badge>
                                            {p.estado === 'Rechazada' && p.motivo_rechazo && (
                                                <p style={{ margin: '4px 0 0', fontSize: 11, color: colors.textMuted }}>{p.motivo_rechazo}</p>
                                            )}
                                        </td>
                                        <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'right' }}>
                                            {p.estado === 'Pendiente' && (
                                                <Btn size="sm" variant="outline" onClick={() => cancelarPermiso(p.solicitud_id)}>Cancelar</Btn>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            )}

            {/* Beneficios sociales (Fase 5): gratificación y CTS */}
            {beneficios.length > 0 && (
                <Card style={{ marginBottom: 28 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Mis beneficios sociales</h3>
                    <table style={tableStyles.table as React.CSSProperties}>
                        <thead><tr>
                            <th style={tableStyles.th as React.CSSProperties}>Beneficio</th>
                            <th style={tableStyles.th as React.CSSProperties}>Periodo</th>
                            <th style={{ ...(tableStyles.th as React.CSSProperties), textAlign: 'right' }}>Monto neto</th>
                            <th style={tableStyles.th as React.CSSProperties}>Estado</th>
                        </tr></thead>
                        <tbody>
                            {beneficios.map((b) => (
                                <tr key={`${b.tipo}-${b.id}`}>
                                    <td style={tableStyles.td as React.CSSProperties}>
                                        <Badge tone={b.tipo === 'Gratificacion' ? 'purple' : 'blue'}>{b.tipo}</Badge>
                                    </td>
                                    <td style={tableStyles.td as React.CSSProperties}>{b.periodo}</td>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'right', fontWeight: 700, color: colors.textStrong }}>{soles(b.monto_neto)}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>
                                        <Badge tone={b.estado === 'Pagado' ? 'green' : 'amber'}>{b.estado}</Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {/* Conceptos variables (Fase 5): comisiones, adelantos y préstamos */}
            {conceptos.length > 0 && (
                <Card style={{ marginBottom: 28 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Comisiones, adelantos y préstamos</h3>
                    <table style={tableStyles.table as React.CSSProperties}>
                        <thead><tr>
                            <th style={tableStyles.th as React.CSSProperties}>Tipo</th>
                            <th style={tableStyles.th as React.CSSProperties}>Periodo</th>
                            <th style={{ ...(tableStyles.th as React.CSSProperties), textAlign: 'right' }}>Monto</th>
                            <th style={{ ...(tableStyles.th as React.CSSProperties), textAlign: 'right' }}>Cuotas</th>
                            <th style={tableStyles.th as React.CSSProperties}>Estado</th>
                        </tr></thead>
                        <tbody>
                            {conceptos.map((c) => (
                                <tr key={c.id}>
                                    <td style={tableStyles.td as React.CSSProperties}>
                                        <Badge tone={TIPO_CONCEPTO_TONE[c.tipo] || 'gray'}>{c.tipo}</Badge>
                                    </td>
                                    <td style={tableStyles.td as React.CSSProperties}>{c.periodo}</td>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'right', fontWeight: 700, color: colors.textStrong }}>{soles(c.monto)}</td>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'right' }}>{c.cuotas}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>
                                        <Badge tone={c.estado === 'Activo' ? 'green' : 'gray'}>{c.estado}</Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {/* Mi desempeño (Fase 5): evaluaciones y kardex, solo lectura */}
            {(evaluaciones.length > 0 || incidencias.length > 0) && (
                <Card style={{ marginBottom: 28 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Mi desempeño</h3>
                    {evaluaciones.length > 0 && (
                        <div style={{ marginBottom: incidencias.length > 0 ? 20 : 0 }}>
                            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Evaluaciones</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {evaluaciones.map((e) => (
                                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: colors.bg, borderRadius: radius.md }}>
                                        <span style={{ fontSize: 13.5, color: colors.textStrong, fontWeight: 600 }}>{e.periodo}</span>
                                        <Badge tone={e.puntaje_promedio >= 4 ? 'green' : e.puntaje_promedio >= 3 ? 'amber' : 'red'}>{e.puntaje_promedio.toFixed(2)} / 5.00</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {incidencias.length > 0 && (
                        <div>
                            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Kardex disciplinario</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {incidencias.map((i) => (
                                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: colors.bg, borderRadius: radius.md }}>
                                        <span style={{ fontSize: 13, color: colors.textStrong }}>{i.tipo.replace(/_/g, ' ')}</span>
                                        <span style={{ fontSize: 12, color: colors.textMuted }}>{i.fecha}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            )}

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
