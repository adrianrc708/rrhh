import React, { useEffect, useState } from 'react';
import { colors, font } from '../theme';
import api from '../services/api';
import {
    Card, PageHeader, Badge, Loading, Empty, tableStyles, Btn, Field, Select,
    inputStyle, useToast, Tabs, Modal,
} from '../components/ui';
import { SECTIONS, SectionKey } from '../auth/roles';

// ============================================================================
// Fase 7 — Configuración (Admin: facturación + roles; RRHH: solicitudes de datos).
// ============================================================================

const soles = (n: number | string) =>
    'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Secciones asignables a usuarios (todas menos el panel SuperAdmin).
const SECCIONES_ASIGNABLES = (Object.keys(SECTIONS) as SectionKey[]).filter((k) => k !== 'admin');

interface Pago { pago_id: number; plan: string; num_empleados: number; monto: number; metodo_pago: string; referencia: string; estado: string; fecha_pago?: string; }
interface Facturacion { razon_social: string; ruc: string; plan: string; estado: string; total_pagado: number; pagos: Pago[]; }
interface PermUser { usuario_id: number; nombre: string; correo: string; rol: string; secciones: string[]; personalizado: boolean; }
interface SolDatos { solicitud_id: number; empleado_nombre?: string; tipo_cambio: string; payload: any; estado: string; fecha_creacion?: string; }

export default function Configuracion({ userRol }: { userRol: string }) {
    const esAdmin = userRol === 'Admin' || userRol === 'SuperAdmin';
    const tabs = ['Facturación', 'Roles y accesos'];
    const [tab, setTab] = useState(tabs[0]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const [fact, setFact] = useState<Facturacion | null>(null);
    const [perms, setPerms] = useState<PermUser[]>([]);

    // Pago modal
    const [pagoModal, setPagoModal] = useState(false);
    const [numEmp, setNumEmp] = useState('1');
    const [metodo, setMetodo] = useState('Tarjeta');
    const [tarjeta, setTarjeta] = useState('');

    // Roles editor
    const [editUser, setEditUser] = useState<PermUser | null>(null);
    const [editSecciones, setEditSecciones] = useState<string[]>([]);

    const cargar = async () => {
        try {
            const [f, p] = await Promise.all([
                api.get('/saas/facturacion').catch(() => ({ data: null })),
                api.get('/saas/permisos').catch(() => ({ data: [] })),
            ]);
            setFact(f?.data || null);
            setPerms(Array.isArray(p?.data) ? p.data : []);
        } catch { toast('error', 'No se pudo cargar la configuración.'); }
        finally { setLoading(false); }
    };
    useEffect(() => { cargar(); }, []);

    const pagar = async () => {
        try {
            await api.post('/saas/facturacion/pagar', {
                num_empleados: Number(numEmp), metodo_pago: metodo,
                tarjeta_ultimos4: metodo === 'Tarjeta' ? tarjeta.slice(-4) : null,
            });
            toast('success', 'Pago registrado.');
            setPagoModal(false);
            cargar();
        } catch (e: any) { toast('error', e?.response?.data?.detail || 'No se pudo procesar el pago.'); }
    };

    const descargarFactura = async (id: number) => {
        try {
            const res = await api.get(`/saas/facturacion/factura/${id}`);
            const blob = new Blob([res.data.contenido], { type: 'text/html;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = res.data.filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch { toast('error', 'No se pudo descargar la factura.'); }
    };

    const abrirEditor = (u: PermUser) => { setEditUser(u); setEditSecciones([...u.secciones]); };
    const toggleSeccion = (k: string) => setEditSecciones((prev) => prev.includes(k) ? prev.filter((s) => s !== k) : [...prev, k]);
    const guardarPermisos = async (restablecer = false) => {
        if (!editUser) return;
        try {
            await api.put(`/saas/permisos/${editUser.usuario_id}`, { secciones: restablecer ? null : editSecciones });
            toast('success', restablecer ? 'Accesos restablecidos al rol.' : 'Accesos actualizados.');
            setEditUser(null);
            cargar();
        } catch (e: any) { toast('error', e?.response?.data?.detail || 'No se pudo guardar.'); }
    };

    if (loading) return <Loading text="Cargando configuración…" />;

    return (
        <div style={{ fontFamily: font }}>
            <PageHeader title="Configuración" subtitle="Administra tu suscripción, los accesos de tu equipo y las solicitudes de datos." />
            <Tabs tabs={tabs} active={tab} onChange={setTab} />

            {/* Facturación */}
            {tab === 'Facturación' && esAdmin && (
                <>
                    {fact && (
                        <Card style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: colors.textStrong }}>{fact.razon_social}</h3>
                                    <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>RUC {fact.ruc} · Plan <strong>{fact.plan}</strong></p>
                                </div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <Badge tone={fact.estado === 'Activa' ? 'green' : fact.estado === 'Suspendida' ? 'red' : 'gray'}>{fact.estado}</Badge>
                                    <Btn icon="dollar" onClick={() => setPagoModal(true)}>Renovar / pagar</Btn>
                                </div>
                            </div>
                        </Card>
                    )}
                    <Card>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Historial de pagos</h3>
                        {!fact || fact.pagos.length === 0 ? <Empty text="Sin pagos registrados." /> : (
                            <table style={tableStyles.table as React.CSSProperties}>
                                <thead><tr>
                                    <th style={tableStyles.th as React.CSSProperties}>Referencia</th>
                                    <th style={tableStyles.th as React.CSSProperties}>Fecha</th>
                                    <th style={tableStyles.th as React.CSSProperties}>Plan</th>
                                    <th style={tableStyles.th as React.CSSProperties}>Monto</th>
                                    <th style={tableStyles.th as React.CSSProperties}>Estado</th>
                                    <th style={tableStyles.th as React.CSSProperties}></th>
                                </tr></thead>
                                <tbody>
                                    {fact.pagos.map((p) => (
                                        <tr key={p.pago_id}>
                                            <td style={tableStyles.td as React.CSSProperties}>{p.referencia}</td>
                                            <td style={tableStyles.td as React.CSSProperties}>{p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-PE') : '—'}</td>
                                            <td style={tableStyles.td as React.CSSProperties}>{p.plan} · {p.num_empleados}</td>
                                            <td style={{ ...(tableStyles.td as React.CSSProperties), fontWeight: 700, color: colors.textStrong }}>{soles(p.monto)}</td>
                                            <td style={tableStyles.td as React.CSSProperties}><Badge tone={p.estado === 'Aprobado' ? 'green' : 'orange'}>{p.estado}</Badge></td>
                                            <td style={tableStyles.td as React.CSSProperties}><Btn size="sm" variant="outline" icon="download" onClick={() => descargarFactura(p.pago_id)}>Factura</Btn></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Card>
                </>
            )}

            {/* Roles y accesos */}
            {tab === 'Roles y accesos' && esAdmin && (
                <Card>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted }}>
                        Personaliza qué secciones ve cada usuario. Sin personalizar, hereda los accesos de su rol.
                    </p>
                    {perms.length === 0 ? <Empty text="Sin usuarios." /> : (
                        <table style={tableStyles.table as React.CSSProperties}>
                            <thead><tr>
                                <th style={tableStyles.th as React.CSSProperties}>Usuario</th>
                                <th style={tableStyles.th as React.CSSProperties}>Rol</th>
                                <th style={tableStyles.th as React.CSSProperties}>Accesos</th>
                                <th style={tableStyles.th as React.CSSProperties}></th>
                            </tr></thead>
                            <tbody>
                                {perms.map((u) => (
                                    <tr key={u.usuario_id}>
                                        <td style={tableStyles.td as React.CSSProperties}>{u.nombre}<br /><span style={{ fontSize: 12, color: colors.textFaint }}>{u.correo}</span></td>
                                        <td style={tableStyles.td as React.CSSProperties}>{u.rol}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>
                                            <span style={{ fontSize: 12, color: colors.textMuted }}>{u.secciones.length} sección(es)</span>
                                            {u.personalizado && <> · <Badge tone="purple">Personalizado</Badge></>}
                                        </td>
                                        <td style={tableStyles.td as React.CSSProperties}>
                                            {u.rol !== 'SuperAdmin' && <Btn size="sm" variant="outline" icon="edit" onClick={() => abrirEditor(u)}>Editar</Btn>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            )}

            {/* Modal de pago */}
            {pagoModal && (
                <Modal title="Renovar suscripción" onClose={() => setPagoModal(false)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <Field label="N.º de usuarios"><input style={inputStyle} value={numEmp} onChange={(e) => setNumEmp(e.target.value)} /></Field>
                        <Field label="Método de pago">
                            <Select value={metodo} onChange={setMetodo}>
                                <option value="Tarjeta">Tarjeta</option>
                                <option value="Yape">Yape</option>
                                <option value="Transferencia">Transferencia</option>
                            </Select>
                        </Field>
                        {metodo === 'Tarjeta' && (
                            <Field label="N.º de tarjeta"><input style={inputStyle} value={tarjeta} onChange={(e) => setTarjeta(e.target.value)} placeholder="**** **** **** 1234" /></Field>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                            <Btn variant="ghost" onClick={() => setPagoModal(false)}>Cancelar</Btn>
                            <Btn icon="check" onClick={pagar}>Pagar</Btn>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal editor de accesos */}
            {editUser && (
                <Modal title={`Accesos de ${editUser.nombre}`} onClose={() => setEditUser(null)}>
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textMuted }}>Marca las secciones que este usuario podrá ver.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {SECCIONES_ASIGNABLES.map((k) => (
                            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                                <input type="checkbox" checked={editSecciones.includes(k)} onChange={() => toggleSeccion(k)} />
                                {SECTIONS[k].label}
                            </label>
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
                        <Btn variant="ghost" onClick={() => guardarPermisos(true)}>Restablecer a su rol</Btn>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <Btn variant="ghost" onClick={() => setEditUser(null)}>Cancelar</Btn>
                            <Btn icon="check" onClick={() => guardarPermisos(false)}>Guardar</Btn>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
