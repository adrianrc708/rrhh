import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors } from '../theme';
import { Card, PageHeader, Tabs, Badge, Btn, Loading, Empty, tableStyles, downloadCSV } from '../components/ui';
import FormularioEmpleado from '../components/FormularioEmpleado';
import Estructura from '../components/Estructura';
import Contratos from '../components/Contratos';

function Directorio() {
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
            alert('No se pudo procesar la baja del colaborador.');
        }
    };

    const handleReactivar = async (id: number) => {
        try {
            await api.patch(`/empleados/${id}`, { estado: 'Activo' });
            cargar();
        } catch (err) {
            console.error('Error al reactivar:', err);
            alert('No se pudo reactivar al colaborador.');
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

export default function Personal() {
    const [tab, setTab] = useState('Directorio');
    return (
        <div>
            <PageHeader title="Gestión de Personal" subtitle="Administración centralizada de colaboradores y estructura organizativa" />
            <Tabs tabs={['Directorio', 'Organigrama', 'Contratos']} active={tab} onChange={setTab} />
            <Card>
                {tab === 'Directorio' && <Directorio />}
                {tab === 'Organigrama' && <Estructura />}
                {tab === 'Contratos' && <Contratos />}
            </Card>
        </div>
    );
}
