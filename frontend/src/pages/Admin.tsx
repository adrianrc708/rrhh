import React, { useEffect, useState } from 'react';
import { colors, radius, font, shadow } from '../theme';
import api from '../services/api';
import Icon from '../components/Icons';
import { Card, Btn, Badge, KpiCard, useToast, inputStyle, Field, tableStyles, Empty } from '../components/ui';
import ParametrosFiscales from '../components/ParametrosFiscales';

interface UsuarioAdmin {
    usuario_id: number;
    nombre: string;
    correo: string;
    rol: string;
    estado: string;
}

interface EmpresaAdmin {
    empresa_id: number;
    razon_social: string;
    ruc: string;
    plan_suscripcion: string;
    estado: string;
    regimen_laboral: string;
    fecha_registro: string;
    usuarios: UsuarioAdmin[];
}

interface AdminStats {
    total_empresas: number;
    total_usuarios: number;
    empresas_por_plan: Record<string, number>;
    empresas_activas: number;
}

export default function Admin() {
    const toast = useToast();
    const [empresas, setEmpresas] = useState<EmpresaAdmin[]>([]);
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // View state
    const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaAdmin | null>(null);
    const [tab, setTab] = useState<'Datos' | 'Usuarios'>('Datos');
    // Fase 1: vista global del panel (empresas vs. parámetros fiscales del SaaS).
    const [vista, setVista] = useState<'empresas' | 'parametros' | 'comunicacion' | 'logs'>('empresas');
    
    // Modals
    const [showUserModal, setShowUserModal] = useState(false);
    const [showEmpresaModal, setShowEmpresaModal] = useState(false);
    const [formData, setFormData] = useState<any>({});
    
    const fetchData = async () => {
        try {
            setLoading(true);
            const [empresasRes, statsRes] = await Promise.all([
                api.get('/admin/empresas'),
                api.get('/admin/stats')
            ]);
            setEmpresas(empresasRes.data);
            setStats(statsRes.data);
            if (selectedEmpresa) {
                const updated = empresasRes.data.find((e: any) => e.empresa_id === selectedEmpresa.empresa_id);
                setSelectedEmpresa(updated || null);
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const impersonate = async (userId: number) => {
        if (!window.confirm("¿Seguro que deseas iniciar sesión como este usuario? Tu sesión actual se cerrará.")) return;
        try {
            const res = await api.post(`/admin/impersonate/${userId}`);
            localStorage.setItem('token', res.data.access_token);
            localStorage.setItem('user', JSON.stringify(res.data.usuario));
            window.location.href = '/';
        } catch (e: any) {
            toast('error', 'Error al impersonar: ' + (e.response?.data?.detail || e.message));
        }
    };

    const eliminarUsuario = async (id: number) => {
        if (!window.confirm("¿Eliminar permanentemente este usuario?")) return;
        try {
            await api.delete(`/admin/usuarios/${id}`);
            toast('success', 'Usuario eliminado');
            fetchData();
        } catch (e: any) {
            toast('error', 'Error: ' + (e.response?.data?.detail || e.message));
        }
    };

    const eliminarEmpresa = async (id: number) => {
        if (!window.confirm("¿Eliminar permanentemente esta empresa y todos sus datos?")) return;
        try {
            await api.delete(`/admin/empresas/${id}`);
            toast('success', 'Empresa eliminada');
            setSelectedEmpresa(null);
            fetchData();
        } catch (e: any) {
            toast('error', 'Error: ' + (e.response?.data?.detail || e.message));
        }
    };

    const guardarEmpresa = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.empresa_id) {
                await api.put(`/admin/empresas/${formData.empresa_id}`, formData);
                toast('success', 'Empresa actualizada');
            } else {
                await api.post('/admin/empresas', formData);
                toast('success', 'Empresa creada');
            }
            setShowEmpresaModal(false);
            fetchData();
        } catch (e: any) {
            toast('error', 'Error: ' + (e.response?.data?.detail || e.message));
        }
    };

    const crearUsuario = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmpresa) return;
        try {
            await api.post(`/admin/empresas/${selectedEmpresa.empresa_id}/usuarios`, formData);
            toast('success', 'Usuario creado');
            setShowUserModal(false);
            fetchData();
        } catch (e: any) {
            toast('error', 'Error: ' + (e.response?.data?.detail || e.message));
        }
    };

    if (loading && !stats) return <div style={{ padding: 40 }}>Cargando...</div>;
    if (error) return <div style={{ padding: 40, color: colors.red }}>{error}</div>;

    // DETAIL VIEW
    if (selectedEmpresa) {
        return (
            <div style={{ fontFamily: font }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                    <Btn variant="outline" onClick={() => setSelectedEmpresa(null)} icon="chevronLeft">Volver</Btn>
                    <div>
                        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: colors.textStrong }}>{selectedEmpresa.razon_social}</h1>
                        <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>ID: {selectedEmpresa.empresa_id} • RUC: {selectedEmpresa.ruc}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
                    <button 
                        onClick={() => setTab('Datos')}
                        style={{ padding: '8px 16px', background: tab === 'Datos' ? colors.indigo : 'transparent', color: tab === 'Datos' ? '#fff' : colors.textBody, border: 'none', borderRadius: radius.md, cursor: 'pointer', fontWeight: 600 }}
                    >Datos de Empresa</button>
                    <button 
                        onClick={() => setTab('Usuarios')}
                        style={{ padding: '8px 16px', background: tab === 'Usuarios' ? colors.indigo : 'transparent', color: tab === 'Usuarios' ? '#fff' : colors.textBody, border: 'none', borderRadius: radius.md, cursor: 'pointer', fontWeight: 600 }}
                    >Usuarios ({selectedEmpresa.usuarios.length})</button>
                </div>

                {tab === 'Datos' && (
                    <Card style={{ maxWidth: 600 }}>
                        <div style={{ display: 'grid', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>Estado</label>
                                <Badge color={selectedEmpresa.estado === 'Activa' ? 'green' : 'red'}>{selectedEmpresa.estado}</Badge>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>Plan de Suscripción</label>
                                <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedEmpresa.plan_suscripcion}</div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>Régimen laboral</label>
                                <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedEmpresa.regimen_laboral || 'General'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                                <Btn variant="outline" icon="edit" onClick={() => { setFormData(selectedEmpresa); setShowEmpresaModal(true); }}>Editar Empresa</Btn>
                                <Btn variant="danger" icon="trash" onClick={() => eliminarEmpresa(selectedEmpresa.empresa_id)}>Eliminar Empresa</Btn>
                            </div>
                        </div>
                    </Card>
                )}

                {tab === 'Usuarios' && (
                    <Card>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                            <Btn variant="indigo" icon="plus" onClick={() => { setFormData({ rol: 'RRHH' }); setShowUserModal(true); }}>Añadir Usuario</Btn>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
                                    <th style={{ padding: '16px', fontSize: 13, color: colors.textMuted }}>ID</th>
                                    <th style={{ padding: '16px', fontSize: 13, color: colors.textMuted }}>Nombre</th>
                                    <th style={{ padding: '16px', fontSize: 13, color: colors.textMuted }}>Correo</th>
                                    <th style={{ padding: '16px', fontSize: 13, color: colors.textMuted }}>Rol</th>
                                    <th style={{ padding: '16px', fontSize: 13, color: colors.textMuted }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...selectedEmpresa.usuarios].sort((a, b) => a.usuario_id - b.usuario_id).map(u => (
                                    <tr key={u.usuario_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                        <td style={{ padding: '16px', fontSize: 14 }}>#{u.usuario_id}</td>
                                        <td style={{ padding: '16px', fontSize: 14, fontWeight: 500 }}>{u.nombre}</td>
                                        <td style={{ padding: '16px', fontSize: 14, color: colors.textBody }}>{u.correo}</td>
                                        <td style={{ padding: '16px' }}><Badge color="indigo">{u.rol}</Badge></td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <Btn variant="outline" size="sm" icon="logIn" onClick={() => impersonate(u.usuario_id)}>Entrar</Btn>
                                                <Btn variant="danger" size="sm" icon="trash" onClick={() => eliminarUsuario(u.usuario_id)}>Borrar</Btn>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                )}

                {/* USER MODAL */}
                {showUserModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                        <div style={{ background: '#fff', padding: 24, borderRadius: radius.lg, width: 400 }}>
                            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Nuevo Usuario</h3>
                            <form onSubmit={crearUsuario} style={{ display: 'grid', gap: 16 }}>
                                <div><label style={{ fontSize: 13 }}>Nombre</label><input required type="text" style={inputStyle} value={formData.nombre || ''} onChange={e => setFormData({...formData, nombre: e.target.value})} /></div>
                                <div><label style={{ fontSize: 13 }}>Correo</label><input required type="email" style={inputStyle} value={formData.correo || ''} onChange={e => setFormData({...formData, correo: e.target.value})} /></div>
                                <div><label style={{ fontSize: 13 }}>Contraseña</label><input required type="password" style={inputStyle} value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
                                <div><label style={{ fontSize: 13 }}>Rol</label>
                                    <select style={inputStyle} value={formData.rol || 'RRHH'} onChange={e => setFormData({...formData, rol: e.target.value})}>
                                        <option value="SuperAdmin">SuperAdmin</option>
                                        <option value="Admin">Admin</option>
                                        <option value="RRHH">RRHH</option>
                                        <option value="Gerente">Gerente</option>
                                        <option value="Empleado">Empleado</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                                    <Btn type="button" variant="outline" onClick={() => setShowUserModal(false)}>Cancelar</Btn>
                                    <Btn type="submit" variant="indigo">Guardar</Btn>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                
                {/* EMPRESA MODAL (EDIT) */}
                {showEmpresaModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                        <div style={{ background: '#fff', padding: 24, borderRadius: radius.lg, width: 400 }}>
                            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Editar Empresa</h3>
                            <form onSubmit={guardarEmpresa} style={{ display: 'grid', gap: 16 }}>
                                <div><label style={{ fontSize: 13 }}>Razón Social</label><input required type="text" style={inputStyle} value={formData.razon_social || ''} onChange={e => setFormData({...formData, razon_social: e.target.value})} /></div>
                                <div><label style={{ fontSize: 13 }}>RUC</label><input required type="text" style={inputStyle} value={formData.ruc || ''} onChange={e => setFormData({...formData, ruc: e.target.value})} /></div>
                                <div><label style={{ fontSize: 13 }}>Plan</label>
                                    <select style={inputStyle} value={formData.plan_suscripcion || 'Micro'} onChange={e => setFormData({...formData, plan_suscripcion: e.target.value})}>
                                        <option value="Micro">Micro</option>
                                        <option value="Estándar">Estándar</option>
                                        <option value="Corporativo">Corporativo</option>
                                    </select>
                                </div>
                                <div><label style={{ fontSize: 13 }}>Estado</label>
                                    <select style={inputStyle} value={formData.estado || 'Activa'} onChange={e => setFormData({...formData, estado: e.target.value})}>
                                        <option value="Activa">Activa</option>
                                        <option value="Suspendida">Suspendida</option>
                                    </select>
                                </div>
                                <div><label style={{ fontSize: 13 }}>Régimen laboral</label>
                                    <select style={inputStyle} value={formData.regimen_laboral || 'General'} onChange={e => setFormData({...formData, regimen_laboral: e.target.value})}>
                                        <option value="General">Régimen General</option>
                                        <option value="MYPE_Pequena">MYPE Pequeña</option>
                                        <option value="MYPE_Micro">MYPE Micro</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                                    <Btn type="button" variant="outline" onClick={() => setShowEmpresaModal(false)}>Cancelar</Btn>
                                    <Btn type="submit" variant="indigo">Guardar</Btn>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // LIST VIEW
    return (
        <div style={{ fontFamily: font }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: colors.textStrong }}>Panel de Super Admin</h1>
                    <p style={{ margin: 0, fontSize: 15, color: colors.textMuted }}>Monitorización y gestión global del SaaS.</p>
                </div>
                {vista === 'empresas' && (
                    <Btn variant="indigo" icon="plus" onClick={() => { setFormData({ estado: 'Activa', plan_suscripcion: 'Micro', regimen_laboral: 'General' }); setShowEmpresaModal(true); }}>Nueva Empresa</Btn>
                )}
            </div>

            {/* Conmutador de vista global */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
                <button onClick={() => setVista('empresas')}
                    style={{ padding: '8px 16px', background: vista === 'empresas' ? colors.indigo : 'transparent', color: vista === 'empresas' ? '#fff' : colors.textBody, border: `1px solid ${vista === 'empresas' ? colors.indigo : colors.border}`, borderRadius: radius.md, cursor: 'pointer', fontWeight: 600, fontFamily: font }}>
                    Empresas
                </button>
                <button onClick={() => setVista('parametros')}
                    style={{ padding: '8px 16px', background: vista === 'parametros' ? colors.indigo : 'transparent', color: vista === 'parametros' ? '#fff' : colors.textBody, border: `1px solid ${vista === 'parametros' ? colors.indigo : colors.border}`, borderRadius: radius.md, cursor: 'pointer', fontWeight: 600, fontFamily: font }}>
                    Parámetros Fiscales
                </button>
                <button onClick={() => setVista('comunicacion')}
                    style={{ padding: '8px 16px', background: vista === 'comunicacion' ? colors.indigo : 'transparent', color: vista === 'comunicacion' ? '#fff' : colors.textBody, border: `1px solid ${vista === 'comunicacion' ? colors.indigo : colors.border}`, borderRadius: radius.md, cursor: 'pointer', fontWeight: 600, fontFamily: font }}>
                    Comunicación masiva
                </button>
                <button onClick={() => setVista('logs')}
                    style={{ padding: '8px 16px', background: vista === 'logs' ? colors.indigo : 'transparent', color: vista === 'logs' ? '#fff' : colors.textBody, border: `1px solid ${vista === 'logs' ? colors.indigo : colors.border}`, borderRadius: radius.md, cursor: 'pointer', fontWeight: 600, fontFamily: font }}>
                    Auditoría técnica
                </button>
            </div>

            {vista === 'parametros' && <ParametrosFiscales />}
            {vista === 'comunicacion' && <BroadcastPanel />}
            {vista === 'logs' && <LogsPanel />}

            {/* KPIs */}
            {vista === 'empresas' && stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
                    <KpiCard label="Total Empresas" value={stats.total_empresas.toString()} icon="building" />
                    <KpiCard label="Empresas Activas" value={stats.empresas_activas.toString()} icon="check" />
                    <KpiCard label="Total Usuarios" value={stats.total_usuarios.toString()} icon="users" />
                    <KpiCard label="Planes" value={Object.keys(stats.empresas_por_plan).length.toString()} sub={`Corporativo: ${stats.empresas_por_plan['Corporativo'] || 0}`} icon="trending" />
                </div>
            )}

            {vista === 'empresas' && (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
                            <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: colors.textMuted }}>ID / EMPRESA</th>
                            <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: colors.textMuted }}>PLAN</th>
                            <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: colors.textMuted }}>ESTADO</th>
                            <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: colors.textMuted }}>USUARIOS</th>
                            <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: colors.textMuted }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {empresas.map((emp) => (
                            <tr key={emp.empresa_id} style={{ borderBottom: `1px solid ${colors.border}`, cursor: 'pointer' }} onClick={() => setSelectedEmpresa(emp)}>
                                <td style={{ padding: '18px 24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: radius.full, background: colors.indigo, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                                            {emp.empresa_id}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: colors.textStrong }}>{emp.razon_social}</div>
                                            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>RUC: {emp.ruc}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '18px 24px' }}>
                                    <Badge color="orange">{emp.plan_suscripcion}</Badge>
                                </td>
                                <td style={{ padding: '18px 24px' }}>
                                    <Badge color={emp.estado === 'Activa' ? 'green' : 'red'}>{emp.estado}</Badge>
                                </td>
                                <td style={{ padding: '18px 24px' }}>
                                    <div style={{ fontSize: 14, color: colors.textBody, fontWeight: 500 }}>{emp.usuarios.length} integr.</div>
                                </td>
                                <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                                    <Btn variant="outline" size="sm" icon="chevronRight" onClick={() => setSelectedEmpresa(emp)}>Ver</Btn>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
            )}

            {/* EMPRESA MODAL (CREATE) */}
            {showEmpresaModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ background: '#fff', padding: 24, borderRadius: radius.lg, width: 400 }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Nueva Empresa</h3>
                        <form onSubmit={guardarEmpresa} style={{ display: 'grid', gap: 16 }}>
                            <div><label style={{ fontSize: 13 }}>Razón Social</label><input required type="text" style={inputStyle} value={formData.razon_social || ''} onChange={e => setFormData({...formData, razon_social: e.target.value})} /></div>
                            <div><label style={{ fontSize: 13 }}>RUC</label><input required type="text" style={inputStyle} value={formData.ruc || ''} onChange={e => setFormData({...formData, ruc: e.target.value})} /></div>
                            <div><label style={{ fontSize: 13 }}>Plan</label>
                                <select style={inputStyle} value={formData.plan_suscripcion || 'Micro'} onChange={e => setFormData({...formData, plan_suscripcion: e.target.value})}>
                                    <option value="Micro">Micro</option>
                                    <option value="Estándar">Estándar</option>
                                    <option value="Corporativo">Corporativo</option>
                                </select>
                            </div>
                            <div><label style={{ fontSize: 13 }}>Estado</label>
                                <select style={inputStyle} value={formData.estado || 'Activa'} onChange={e => setFormData({...formData, estado: e.target.value})}>
                                    <option value="Activa">Activa</option>
                                    <option value="Suspendida">Suspendida</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                                <Btn type="button" variant="outline" onClick={() => setShowEmpresaModal(false)}>Cancelar</Btn>
                                <Btn type="submit" variant="indigo">Guardar</Btn>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Fase 7: comunicación masiva (broadcast global) ─────────────────────────
function BroadcastPanel() {
    const toast = useToast();
    const [titulo, setTitulo] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [soloActivas, setSoloActivas] = useState(true);
    const [enviando, setEnviando] = useState(false);

    const enviar = async () => {
        if (!titulo.trim() || !mensaje.trim()) { toast('error', 'Completa título y mensaje.'); return; }
        setEnviando(true);
        try {
            const res = await api.post('/admin/broadcast', { titulo, mensaje, solo_activas: soloActivas });
            toast('success', `Enviado a ${res.data.notificaciones_enviadas} usuario(s).`);
            setTitulo(''); setMensaje('');
        } catch (e: any) { toast('error', e?.response?.data?.detail || 'No se pudo enviar.'); }
        finally { setEnviando(false); }
    };

    return (
        <Card style={{ maxWidth: 640 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Comunicación masiva</h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: colors.textMuted }}>
                Inyecta una notificación en el dashboard de todas las empresas cliente.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Título"><input style={inputStyle} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Mantenimiento programado" /></Field>
                <Field label="Mensaje"><textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={mensaje} onChange={(e) => setMensaje(e.target.value)} /></Field>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: colors.textBody }}>
                    <input type="checkbox" checked={soloActivas} onChange={(e) => setSoloActivas(e.target.checked)} />
                    Solo empresas activas (excluir suspendidas)
                </label>
                <div><Btn icon="bell" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar a todos'}</Btn></div>
            </div>
        </Card>
    );
}

// ── Fase 7: auditoría técnica global (logs cross-tenant) ───────────────────
function LogsPanel() {
    const [logs, setLogs] = useState<any[]>([]);
    const [nivel, setNivel] = useState('');
    const [loading, setLoading] = useState(true);

    const cargar = async (n?: string) => {
        setLoading(true);
        try {
            const res = await api.get('/infra/logs', { params: n ? { nivel: n } : {} });
            setLogs(Array.isArray(res.data) ? res.data : []);
        } catch { setLogs([]); } finally { setLoading(false); }
    };
    useEffect(() => { cargar(); }, []);

    const TONO: Record<string, any> = { ERROR: 'red', SECURITY: 'amber', WARN: 'orange' };

    return (
        <Card>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {['', 'ERROR', 'SECURITY', 'WARN'].map((n) => (
                    <button key={n || 'todos'} onClick={() => { setNivel(n); cargar(n); }}
                        style={{ padding: '6px 14px', borderRadius: radius.pill, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font,
                            background: nivel === n ? colors.navy900 : '#ECEDF3', color: nivel === n ? colors.orange : colors.textMuted }}>
                        {n || 'Todos'}
                    </button>
                ))}
            </div>
            {loading ? <p style={{ color: colors.textMuted, fontSize: 14 }}>Cargando…</p>
                : logs.length === 0 ? <Empty text="Sin registros técnicos." /> : (
                    <table style={tableStyles.table as React.CSSProperties}>
                        <thead><tr>
                            <th style={tableStyles.th as React.CSSProperties}>Nivel</th>
                            <th style={tableStyles.th as React.CSSProperties}>Método</th>
                            <th style={tableStyles.th as React.CSSProperties}>Ruta</th>
                            <th style={tableStyles.th as React.CSSProperties}>Código</th>
                            <th style={tableStyles.th as React.CSSProperties}>Mensaje</th>
                            <th style={tableStyles.th as React.CSSProperties}>Fecha</th>
                        </tr></thead>
                        <tbody>
                            {logs.map((l) => (
                                <tr key={l.id}>
                                    <td style={tableStyles.td as React.CSSProperties}><Badge tone={TONO[l.nivel] || 'gray'}>{l.nivel}</Badge></td>
                                    <td style={tableStyles.td as React.CSSProperties}>{l.metodo}</td>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), fontSize: 12, fontFamily: 'monospace', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.ruta}</td>
                                    <td style={tableStyles.td as React.CSSProperties}>{l.status_code || '—'}</td>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), fontSize: 12, color: colors.textMuted, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.mensaje}</td>
                                    <td style={{ ...(tableStyles.td as React.CSSProperties), fontSize: 12 }}>{l.fecha_evento ? new Date(l.fecha_evento).toLocaleString('es-PE') : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
        </Card>
    );
}
