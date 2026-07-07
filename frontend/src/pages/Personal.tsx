import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors } from '../theme';
import { Card, PageHeader, Tabs, Badge, Btn, Loading, Empty, tableStyles, downloadCSV, useToast, Select, PasswordField, Modal, Field, inputStyle } from '../components/ui';
import FormularioEmpleado from '../components/FormularioEmpleado';
import Estructura from '../components/Estructura';
import Contratos from '../components/Contratos';
import ModalDesempeno from '../components/ModalDesempeno';

const soles = (n: number) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function FilaLiquidacion({ label, sub, valor }: { label: string; sub: string; valor: number }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.textStrong }}>{label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.textMuted }}>{sub}</p>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: colors.textStrong }}>{soles(valor)}</span>
        </div>
    );
}

function ModalLiquidacion({ empleado, onClose, onDone }: { empleado: any; onClose: () => void; onDone: () => void }) {
    const toast = useToast();
    const [fechaCese, setFechaCese] = useState(new Date().toISOString().slice(0, 10));
    const [motivo, setMotivo] = useState('Renuncia');
    const [calculando, setCalculando] = useState(false);
    const [resultado, setResultado] = useState<any | null>(null);

    const calcular = async () => {
        setCalculando(true);
        try {
            const res = await api.post('/liquidaciones/calcular', {
                empleado_id: empleado.empleado_id, fecha_cese: fechaCese, motivo,
            });
            setResultado(res.data);
            toast('success', 'Liquidación calculada. El colaborador fue dado de baja.');
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo calcular la liquidación.');
        } finally { setCalculando(false); }
    };

    const cerrar = () => { onClose(); if (resultado) onDone(); };

    return (
        <Modal title={`Liquidación — ${empleado.nombre || 'colaborador'}`} onClose={cerrar} width={480}>
            {!resultado ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Field label="Fecha de cese">
                        <input type="date" value={fechaCese} onChange={(e) => setFechaCese(e.target.value)} style={inputStyle} />
                    </Field>
                    <Field label="Motivo">
                        <Select value={motivo} onChange={setMotivo}>
                            <option value="Renuncia">Renuncia</option>
                            <option value="Despido">Despido</option>
                            <option value="Mutuo_acuerdo">Mutuo acuerdo</option>
                            <option value="Fin_contrato">Fin de contrato</option>
                        </Select>
                    </Field>
                    <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, background: colors.blueSoft, padding: '10px 12px', borderRadius: 8, lineHeight: 1.5 }}>
                        Se calcularán las vacaciones truncas, la gratificación trunca y la CTS trunca. El colaborador quedará dado de baja automáticamente.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
                        <Btn variant="danger" onClick={calcular} disabled={calculando}>{calculando ? 'Calculando…' : 'Calcular y dar de baja'}</Btn>
                    </div>
                </div>
            ) : (
                <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                        <FilaLiquidacion label="Vacaciones truncas" sub={`${resultado.dias_vacaciones_truncas} días pendientes`} valor={resultado.monto_vacaciones_truncas} />
                        <FilaLiquidacion label="Gratificación trunca" sub={`${resultado.meses_gratificacion_trunca} mes(es) + bonificación 9%`} valor={resultado.monto_gratificacion_trunca + resultado.bonificacion_extraordinaria} />
                        <FilaLiquidacion label="CTS trunca" sub={`${resultado.meses_cts_trunca} mes(es) de servicio`} valor={resultado.monto_cts_trunca} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${colors.border}`, paddingTop: 14 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: colors.textStrong }}>Total a liquidar</span>
                        <span style={{ fontSize: 24, fontWeight: 800, color: colors.textStrong }}>{soles(resultado.monto_total)}</span>
                    </div>
                    <Btn style={{ width: '100%', justifyContent: 'center', marginTop: 22 }} onClick={cerrar}>Listo</Btn>
                </div>
            )}
        </Modal>
    );
}

function Directorio() {
    const toast = useToast();
    const [empleados, setEmpleados] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [empleadoEdit, setEmpleadoEdit] = useState<any | null>(null);
    const [empleadoLiquidar, setEmpleadoLiquidar] = useState<any | null>(null);
    const [empleadoDesempeno, setEmpleadoDesempeno] = useState<any | null>(null);

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
                                            <Btn size="sm" variant="outline" icon="sparkles" onClick={() => setEmpleadoDesempeno(emp)}>Desempeño</Btn>
                                            {emp.estado === 'Activo' ? (
                                                <Btn size="sm" variant="danger" icon="trash" onClick={() => setEmpleadoLiquidar(emp)}>Baja</Btn>
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

            {empleadoLiquidar && (
                <ModalLiquidacion
                    empleado={empleadoLiquidar}
                    onClose={() => setEmpleadoLiquidar(null)}
                    onDone={cargar}
                />
            )}

            {empleadoDesempeno && (
                <ModalDesempeno
                    empleado={empleadoDesempeno}
                    onClose={() => setEmpleadoDesempeno(null)}
                />
            )}
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
