import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors } from '../theme';
import { Card, PageHeader, Tabs, Badge, Btn, Loading, Empty, tableStyles, downloadCSV, useToast, Select, PasswordField } from '../components/ui';
import FormularioEmpleado from '../components/FormularioEmpleado';
import Estructura from '../components/Estructura';
import Contratos from '../components/Contratos';

function Directorio() {
    const toast = useToast();
    const [empleados, setEmpleados] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [empleadoEdit, setEmpleadoEdit] = useState<any | null>(null);

    const cargar = async () => {
        try {
            setCargando(true);
            const res = await api.get('/empleados/');
            setEmpleados(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error al cargar el directorio:', err);
            setEmpleados([]);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    const handleBaja = async (id: number) => {
        if (!window.confirm('¿Registrar la BAJA de este colaborador? Sus contratos vigentes pasarán a vencidos automáticamente.')) return;
        try {
            await api.patch(`/empleados/${id}`, { estado: 'Inactivo' });
            cargar();
        } catch (err) {
            console.error('Error al dar de baja:', err);
            toast('error', 'No se pudo procesar la baja del colaborador.');
        }
    };

    const handleReactivar = async (id: number) => {
        try {
            await api.patch(`/empleados/${id}`, { estado: 'Activo' });
            cargar();
            toast('success', 'Colaborador reactivado correctamente.');
        } catch (err) {
            console.error('Error al reactivar:', err);
            toast('error', 'No se pudo reactivar al colaborador.');
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.textStrong }}>Listado General de Colaboradores</h3>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textMuted }}>Administración centralizada del personal de la empresa.</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    {empleados.length > 0 && (
                        <Btn variant="indigo" icon="download" onClick={() => downloadCSV('directorio_colaboradores.csv', [
                            ['ID', 'Nombre', 'Régimen Pensión', 'Estado', 'Fecha Ingreso'],
                            ...empleados.map((e) => [e.empleado_id, e.nombre || '', e.tipo_pension || '', e.estado, e.fecha_ingreso || '']),
                        ])}>Exportar CSV</Btn>
                    )}
                    <Btn icon="plus" onClick={() => { setEmpleadoEdit(null); setModalAbierto(true); }}>Registrar Nuevo Colaborador</Btn>
                </div>
            </div>

            {cargando ? <Loading text="Sincronizando registros con la base de datos…" /> : empleados.length === 0 ? (
                <Empty text="Aún no hay colaboradores registrados. Crea el primero con el botón de arriba." />
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyles.table}>
                        <thead>
                            <tr>
                                <th style={tableStyles.th}>ID</th>
                                <th style={tableStyles.th}>Colaborador</th>
                                <th style={tableStyles.th}>Régimen Pensión</th>
                                <th style={tableStyles.th}>Estado</th>
                                <th style={tableStyles.th}>Fecha Ingreso</th>
                                <th style={{ ...tableStyles.th, textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {empleados.map((emp) => (
                                <tr key={emp.empleado_id}>
                                    <td style={{ ...tableStyles.td, fontWeight: 700, color: colors.textStrong }}>{emp.empleado_id}</td>
                                    <td style={{ ...tableStyles.td, fontWeight: 600, color: colors.textStrong }}>{emp.nombre || `Colaborador ${emp.empleado_id}`}</td>
                                    <td style={tableStyles.td}>{emp.tipo_pension || '—'}</td>
                                    <td style={tableStyles.td}>
                                        <Badge tone={emp.estado === 'Activo' ? 'green' : 'red'}>{emp.estado}</Badge>
                                    </td>
                                    <td style={{ ...tableStyles.td, color: colors.textMuted }}>{emp.fecha_ingreso || 'No registrada'}</td>
                                    <td style={{ ...tableStyles.td, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                            <Btn size="sm" variant="outline" icon="edit" onClick={() => { setEmpleadoEdit(emp); setModalAbierto(true); }}>Editar</Btn>
                                            {emp.estado === 'Activo' ? (
                                                <Btn size="sm" variant="danger" icon="trash" onClick={() => handleBaja(emp.empleado_id)}>Baja</Btn>
                                            ) : (
                                                <Btn size="sm" variant="green" icon="refresh" onClick={() => handleReactivar(emp.empleado_id)}>Reactivar</Btn>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <FormularioEmpleado
                isOpen={modalAbierto}
                onClose={() => setModalAbierto(false)}
                onSave={cargar}
                empleadoAEditar={empleadoEdit}
            />
        </div>
    );
}

const ROL_TONE: Record<string, any> = { Admin: 'purple', RRHH: 'blue', Gerente: 'amber', Empleado: 'gray' };

function ModalNuevoUsuario({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const toast = useToast();
    const [nombre, setNombre] = useState('');
    const [correo, setCorreo] = useState('');
    const [password, setPassword] = useState('');
    const [rol, setRol] = useState('Empleado');
    const [guardando, setGuardando] = useState(false);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre || !correo || !password) { toast('warning', 'Completa todos los campos.'); return; }
        try {
            setGuardando(true);
            await api.post('/core/usuarios', { nombre, correo, password, rol });
            toast('success', `Usuario "${nombre}" creado. Ya puede ser asignado como colaborador.`);
            onSaved(); onClose();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo crear el usuario.');
        } finally { setGuardando(false); }
    };

    const inputStyle: React.CSSProperties = {
        padding: '10px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
        fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none',
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,19,40,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: 28, width: 440, boxShadow: '0 12px 32px rgba(16,24,40,0.18)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: colors.textStrong }}>Nuevo Usuario del Sistema</h3>
                <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: colors.textBody }}>Nombre completo</label>
                        <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} placeholder="Ej. Monica Sanchez" autoComplete="name" required />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: colors.textBody }}>Correo electrónico</label>
                        <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} style={inputStyle} placeholder="monica@empresa.com" autoComplete="email" required />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: colors.textBody }}>Contraseña inicial</label>
                            <PasswordField value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" autoComplete="new-password" required />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: colors.textBody }}>Rol</label>
                            <Select value={rol} onChange={setRol}>
                                <option value="Empleado">Empleado</option>
                                <option value="RRHH">RRHH</option>
                                <option value="Gerente">Gerente</option>
                                <option value="Admin">Admin</option>
                            </Select>
                        </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, background: colors.blueSoft, padding: '8px 12px', borderRadius: 8 }}>
                        Después de crear el usuario, ve a <strong>Directorio → Nuevo Colaborador</strong> para asociarlo como empleado.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                        <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
                        <Btn type="submit" variant="orange" disabled={guardando}>{guardando ? 'Creando…' : 'Crear Usuario'}</Btn>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Usuarios() {
    const toast = useToast();
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [modal, setModal] = useState(false);
    const [sinPermiso, setSinPermiso] = useState(false);

    const cargar = async () => {
        try {
            setCargando(true);
            const res = await api.get('/core/usuarios');
            setUsuarios(Array.isArray(res.data) ? res.data : []);
        } catch (err: any) {
            if (err?.response?.status === 403) setSinPermiso(true);
            else toast('error', 'No se pudo cargar la lista de usuarios.');
        } finally { setCargando(false); }
    };

    useEffect(() => { cargar(); }, []);

    if (sinPermiso) return (
        <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textMuted }}>
            <p style={{ fontSize: 15 }}>Solo los administradores pueden gestionar cuentas de usuario.</p>
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.textStrong }}>Cuentas de Acceso al Sistema</h3>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textMuted }}>Usuarios con credenciales de login en la plataforma Omnia.</p>
                </div>
                <Btn icon="plus" variant="orange" onClick={() => setModal(true)}>Nuevo Usuario</Btn>
            </div>

            {cargando ? <Loading /> : usuarios.length === 0 ? <Empty text="No hay usuarios registrados." /> : (
                <table style={tableStyles.table}>
                    <thead>
                        <tr>
                            <th style={tableStyles.th}>Nombre</th>
                            <th style={tableStyles.th}>Correo</th>
                            <th style={tableStyles.th}>Rol</th>
                            <th style={tableStyles.th}>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuarios.map((u: any) => (
                            <tr key={u.usuario_id}>
                                <td style={tableStyles.td}><strong>{u.nombre}</strong></td>
                                <td style={{ ...tableStyles.td, color: colors.textMuted }}>{u.correo}</td>
                                <td style={tableStyles.td}><Badge tone={ROL_TONE[u.rol] || 'gray'}>{u.rol}</Badge></td>
                                <td style={tableStyles.td}><Badge tone={u.estado === 'Activo' ? 'green' : 'red'}>{u.estado}</Badge></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {modal && <ModalNuevoUsuario onClose={() => setModal(false)} onSaved={cargar} />}
        </div>
    );
}

export default function Personal() {
    const [tab, setTab] = useState('Directorio');
    const [superAdminCount, setSuperAdminCount] = useState<number | null>(null);
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : {};

    useEffect(() => {
        if (user.rol === 'SuperAdmin') {
            api.get('/admin/stats').then(res => {
                if (res.data && typeof res.data.total_superadmins === 'number') {
                    setSuperAdminCount(res.data.total_superadmins);
                }
            }).catch(console.error);
        }
    }, [user.rol]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <PageHeader title="Gestión de Personal" subtitle="Administración centralizada de colaboradores y estructura organizativa" />
                {superAdminCount !== null && (
                    <div style={{ background: colors.navy900, color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.orange }} />
                        Super Admins Globales: <strong>{superAdminCount}</strong>
                    </div>
                )}
            </div>
            <Tabs tabs={['Directorio', 'Organigrama', 'Contratos', 'Usuarios']} active={tab} onChange={setTab} />
            <Card>
                {tab === 'Directorio' && <Directorio />}
                {tab === 'Organigrama' && <Estructura />}
                {tab === 'Contratos' && <Contratos />}
                {tab === 'Usuarios' && <Usuarios />}
            </Card>
        </div>
    );
}
