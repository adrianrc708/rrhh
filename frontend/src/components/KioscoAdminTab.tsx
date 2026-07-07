import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { colors, radius, font } from '../theme';
import { Card, Btn, Badge, Field, Select, Loading, Empty, tableStyles, inputStyle, useToast, Modal } from './ui';
import CamaraFacial, { CamaraHandle } from './CamaraFacial';

// Fase 3 — Gestión de dispositivos kiosco + enrolamiento facial (Admin/RRHH).
export default function KioscoAdminTab({ empleados }: { empleados: any[] }) {
    const toast = useToast();
    const [dispositivos, setDispositivos] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);

    // Alta de dispositivo
    const [nombre, setNombre] = useState('');
    const [pin, setPin] = useState('');
    const [tokenCreado, setTokenCreado] = useState<string | null>(null);

    // Enrolamiento
    const camaraRef = useRef<CamaraHandle>(null);
    const [empleadoSel, setEmpleadoSel] = useState('');
    const [rostros, setRostros] = useState<any[]>([]);
    const [enrolando, setEnrolando] = useState(false);

    const cargarDispositivos = async () => {
        try { const r = await api.get('/asistencia/dispositivos'); setDispositivos(r.data); }
        catch (e) { console.error(e); } finally { setCargando(false); }
    };
    useEffect(() => { cargarDispositivos(); }, []);

    const cargarRostros = async (id: string) => {
        if (!id) { setRostros([]); return; }
        try { const r = await api.get(`/asistencia/rostros/empleado/${id}`); setRostros(r.data); }
        catch { setRostros([]); }
    };
    useEffect(() => { cargarRostros(empleadoSel); }, [empleadoSel]);

    const crearDispositivo = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const r = await api.post('/asistencia/dispositivos', { nombre, pin });
            setTokenCreado(r.data.token);
            setNombre(''); setPin('');
            cargarDispositivos();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo crear el dispositivo.');
        }
    };

    const eliminarDispositivo = async (id: number) => {
        if (!window.confirm('¿Desvincular este dispositivo? Dejará de poder marcar.')) return;
        try { await api.delete(`/asistencia/dispositivos/${id}`); toast('success', 'Dispositivo desvinculado.'); cargarDispositivos(); }
        catch (e: any) { toast('error', 'Error: ' + (e.response?.data?.detail || e.message)); }
    };

    const enrolar = async () => {
        if (!empleadoSel) { toast('warning', 'Selecciona un colaborador.'); return; }
        setEnrolando(true);
        try {
            const descriptor = await camaraRef.current?.capturarDescriptor();
            if (!descriptor) { toast('error', 'No se detectó un rostro. Acércate y mira a la cámara.'); return; }
            await api.post('/asistencia/rostros', {
                empleado_id: Number(empleadoSel),
                descriptor,
                etiqueta: `muestra ${rostros.length + 1}`,
            });
            toast('success', 'Rostro enrolado correctamente.');
            cargarRostros(empleadoSel);
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo enrolar el rostro.');
        } finally { setEnrolando(false); }
    };

    const eliminarRostro = async (id: number) => {
        try { await api.delete(`/asistencia/rostros/${id}`); cargarRostros(empleadoSel); }
        catch (e: any) { toast('error', 'Error: ' + (e.response?.data?.detail || e.message)); }
    };

    const urlKiosco = `${window.location.origin}${window.location.pathname}?kiosco`;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, fontFamily: font }}>
            {/* Dispositivos */}
            <Card>
                <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Dispositivos Kiosco</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted }}>
                    Abre el kiosco en la tablet en <code style={{ background: colors.bg, padding: '2px 6px', borderRadius: 4 }}>{urlKiosco}</code> y actívalo con el token + PIN.
                </p>
                <form onSubmit={crearDispositivo} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap' }}>
                    <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Tablet Puerta 1" style={{ ...inputStyle, width: 160 }} /></Field>
                    <Field label="PIN"><input value={pin} onChange={(e) => setPin(e.target.value)} required minLength={4} placeholder="4-12 díg." style={{ ...inputStyle, width: 110 }} /></Field>
                    <Btn type="submit" icon="plus">Crear</Btn>
                </form>
                {cargando ? <Loading /> : dispositivos.length === 0 ? <Empty text="Sin dispositivos registrados." /> : (
                    <table style={tableStyles.table as React.CSSProperties}>
                        <thead><tr>
                            <th style={tableStyles.th as React.CSSProperties}>Nombre</th>
                            <th style={tableStyles.th as React.CSSProperties}>Último uso</th>
                            <th style={{ ...(tableStyles.th as React.CSSProperties), textAlign: 'center' }}></th>
                        </tr></thead>
                        <tbody>
                            {dispositivos.map((d) => (
                                <tr key={d.dispositivo_id}>
                                    <td style={tableStyles.td as React.CSSProperties}>{d.nombre} {d.activo ? <Badge tone="green">activo</Badge> : <Badge tone="gray">inactivo</Badge>}</td>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), color: colors.textMuted }}>{d.ultimo_uso ? new Date(d.ultimo_uso).toLocaleString('es-PE') : 'Nunca'}</td>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), textAlign: 'center' }}>
                                        <Btn size="sm" variant="danger" icon="trash" onClick={() => eliminarDispositivo(d.dispositivo_id)}>Quitar</Btn>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            {/* Enrolamiento */}
            <Card>
                <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>Enrolar Rostro</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted }}>Registra el rostro del colaborador para el reconocimiento en el kiosco.</p>
                <Field label="Colaborador">
                    <Select value={empleadoSel} onChange={setEmpleadoSel}>
                        <option value="">— Seleccionar —</option>
                        {empleados.map((e) => <option key={e.empleado_id} value={e.empleado_id}>{e.nombre || `ID ${e.empleado_id}`}</option>)}
                    </Select>
                </Field>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                    <CamaraFacial ref={camaraRef} ancho={300} alto={225} />
                </div>
                <Btn icon="check" disabled={enrolando || !empleadoSel} onClick={enrolar} style={{ width: '100%', justifyContent: 'center' }}>
                    {enrolando ? 'Procesando…' : 'Capturar y enrolar'}
                </Btn>
                {empleadoSel && (
                    <div style={{ marginTop: 16 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong, margin: '0 0 8px' }}>Muestras enroladas: {rostros.length}</p>
                        {rostros.map((r) => (
                            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: colors.bg, borderRadius: radius.sm, marginBottom: 6 }}>
                                <span style={{ fontSize: 13, color: colors.textBody }}>{r.etiqueta || `Rostro #${r.id}`}</span>
                                <Btn size="sm" variant="ghost" icon="trash" onClick={() => eliminarRostro(r.id)}>Eliminar</Btn>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Token recién creado (se muestra una sola vez) */}
            {tokenCreado && (
                <Modal title="Token del dispositivo" onClose={() => setTokenCreado(null)}>
                    <p style={{ fontSize: 13, color: colors.textMuted, margin: '0 0 12px' }}>
                        Cópialo ahora: por seguridad <strong>no se volverá a mostrar</strong>. Introdúcelo en la tablet junto con el PIN.
                    </p>
                    <div style={{ background: colors.navy900, color: '#fff', padding: '12px 14px', borderRadius: 8, fontFamily: 'monospace', fontSize: 14, wordBreak: 'break-all' }}>{tokenCreado}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                        <Btn variant="outline" onClick={() => { navigator.clipboard?.writeText(tokenCreado); toast('success', 'Token copiado.'); }}>Copiar</Btn>
                        <Btn variant="indigo" onClick={() => setTokenCreado(null)}>Listo</Btn>
                    </div>
                </Modal>
            )}
        </div>
    );
}
