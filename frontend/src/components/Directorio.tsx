import React, { useEffect, useState } from 'react';
import Estructura from './Estructura';
import Contratos from './Contratos';
import FormularioEmpleado from './FormularioEmpleado';
import api from '../services/api';

export default function LayoutPersonal() {
    const [menuPrincipal, setMenuPrincipal] = useState('personal');
    const [subModuloActivo, setSubModuloActivo] = useState<'directorio' | 'estructura' | 'contratos' | 'evaluaciones'>('directorio');

    const [empleados, setEmpleados] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [vistaFormulario, setVistaFormulario] = useState(false);

    const cargarDirectorio = async () => {
        try {
            setCargando(true);
            const respuesta = await api.get('/empleados/');
            setEmpleados(respuesta.data);
        } catch (err) {
            console.error("Error al recopilar el directorio de personal:", err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        if (subModuloActivo === 'directorio') {
            cargarDirectorio();
        }
    }, [subModuloActivo]);

    const handleBajaEmpleado = async (id: number) => {
        if (window.confirm("¿Estás seguro de registrar la BAJA de este colaborador? Sus contratos pasarán a estado vencido automáticamente.")) {
            try {
                await api.put(`/empleados/${id}`, { estado: 'Inactivo' });
                cargarDirectorio();
            } catch (err) {
                console.error("Error al procesar desvinculación:", err);
                alert("No se pudo procesar la baja del colaborador.");
            }
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login';
    };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f4f6f8', fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>

            {/* BARRA LATERAL (SIDEBAR) */}
            <div style={{ width: '260px', backgroundColor: '#1A1C4b', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Omnia</h2>
                        <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Gestión centralizada SaaS</p>
                    </div>

                    <div style={{ padding: '20px 15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button onClick={() => setMenuPrincipal('dashboard')} style={{ ...sidebarBtnStyle, opacity: menuPrincipal === 'dashboard' ? 1 : 0.6 }}>
                            <span style={{ marginRight: '10px' }}>⊞</span> Dashboard
                        </button>

                        <button onClick={() => setMenuPrincipal('personal')} style={{ ...sidebarBtnStyle, backgroundColor: menuPrincipal === 'personal' ? 'rgba(255,255,255,0.1)' : 'transparent', opacity: menuPrincipal === 'personal' ? 1 : 0.6, borderLeft: menuPrincipal === 'personal' ? '4px solid #f97316' : '4px solid transparent' }}>
                            <span style={{ marginRight: '10px' }}>👥</span> Personal
                        </button>

                        <button onClick={() => setMenuPrincipal('asistencia')} style={{ ...sidebarBtnStyle, opacity: menuPrincipal === 'asistencia' ? 1 : 0.6 }}>
                            <span style={{ marginRight: '10px' }}>🕒</span> Asistencia
                        </button>
                        <button onClick={() => setMenuPrincipal('nomina')} style={{ ...sidebarBtnStyle, opacity: menuPrincipal === 'nomina' ? 1 : 0.6 }}>
                            <span style={{ marginRight: '10px' }}>💲</span> Nómina
                        </button>
                        <button onClick={() => setMenuPrincipal('auditoria')} style={{ ...sidebarBtnStyle, opacity: menuPrincipal === 'auditoria' ? 1 : 0.6 }}>
                            <span style={{ marginRight: '10px' }}>☑️</span> Auditoría
                        </button>
                    </div>
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>Usuario</p>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>Admin PYME</p>
                        </div>
                        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Salir</button>
                    </div>
                </div>
            </div>

            {/* ÁREA DE CONTENIDO PRINCIPAL */}
            <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>

                {menuPrincipal === 'personal' ? (
                    <>
                        <div style={{ marginBottom: '30px' }}>
                            <h1 style={{ margin: 0, fontSize: '28px', color: '#111827', fontWeight: 'bold' }}>Gestión de Personal</h1>
                            <p style={{ margin: '5px 0 0 0', color: '#6b7280', fontSize: '15px' }}>Administración centralizada de colaboradores y estructura organizativa.</p>
                        </div>

                        {/* Menú de Submódulos (Pill Tabs) */}
                        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                            <button onClick={() => { setVistaFormulario(false); setSubModuloActivo('directorio'); }} style={subModuloActivo === 'directorio' && !vistaFormulario ? activeTabStyle : inactiveTabStyle}>
                                Directorio
                            </button>
                            <button onClick={() => { setVistaFormulario(false); setSubModuloActivo('estructura'); }} style={subModuloActivo === 'estructura' ? activeTabStyle : inactiveTabStyle}>
                                Organigrama
                            </button>
                            <button onClick={() => { setVistaFormulario(false); setSubModuloActivo('contratos'); }} style={subModuloActivo === 'contratos' ? activeTabStyle : inactiveTabStyle}>
                                Contratos
                            </button>
                            <button style={inactiveTabStyle} disabled>
                                Evaluaciones (Próximamente)
                            </button>
                        </div>

                        {/* Contenedor de Tarjeta */}
                        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>

                            {subModuloActivo === 'directorio' && (
                                vistaFormulario ? (
                                    <FormularioEmpleado onVolver={() => { setVistaFormulario(false); cargarDirectorio(); }} />
                                ) : (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                            <h3 style={{ color: '#1f2937', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Listado General de Colaboradores</h3>

                                            {/* 🔥 COLOR DE FIGMA: Botón principal de acción en naranja corporativo */}
                                            <button
                                                onClick={() => setVistaFormulario(true)}
                                                style={{ padding: '10px 18px', backgroundColor: '#f97316', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s' }}
                                            >
                                                + Registrar Nuevo Colaborador
                                            </button>
                                        </div>

                                        {cargando ? (
                                            <p style={{ color: '#6b7280' }}>Sincronizando registros con la base de datos...</p>
                                        ) : (
                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontWeight: 'bold' }}>
                                                            <th style={{ padding: '12px 8px' }}>ID</th>
                                                            <th style={{ padding: '12px 8px' }}>Nombre / Colaborador</th>
                                                            <th style={{ padding: '12px 8px' }}>Estado</th>
                                                            <th style={{ padding: '12px 8px' }}>Fecha Ingreso</th>
                                                            <th style={{ padding: '12px 8px', textAlign: 'center' }}>Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {empleados.map((emp: any) => (
                                                            <tr key={emp.empleado_id} style={{ borderBottom: '1px solid #f3f4f6', color: '#1f2937' }}>
                                                                <td style={{ padding: '14px 8px', fontWeight: 'bold' }}>{emp.empleado_id}</td>
                                                                <td style={{ padding: '14px 8px', fontWeight: '600' }}>{emp.nombre || `Colaborador ${emp.empleado_id}`}</td>
                                                                <td style={{ padding: '14px 8px' }}>
                                                                    <span style={{
                                                                        padding: '4px 10px',
                                                                        backgroundColor: emp.estado === 'Activo' ? '#d1fae5' : '#fee2e2',
                                                                        color: emp.estado === 'Activo' ? '#065f46' : '#991b1b',
                                                                        borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'
                                                                    }}>
                                                                        {emp.estado}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '14px 8px', color: '#6b7280' }}>{emp.fecha_ingreso || 'No registrada'}</td>
                                                                <td style={{ padding: '14px 8px', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>

                                                                    {/* 🔥 ESTILO FIGMA: Botón de fila en formato Outline Naranja */}
                                                                    <button
                                                                        onClick={() => alert(`Visualizando perfil completo de: ${emp.nombre || emp.empleado_id} (Simulación Figma)`)}
                                                                        style={{ padding: '6px 14px', backgroundColor: 'transparent', color: '#f97316', border: '1px solid #f97316', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }}
                                                                    >
                                                                        Ver Perfil
                                                                    </button>

                                                                    {emp.estado === 'Activo' && (
                                                                        <button
                                                                            onClick={() => handleBajaEmpleado(emp.empleado_id)}
                                                                            style={{ padding: '6px 14px', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }}
                                                                        >
                                                                            Baja
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )
                            )}

                            {subModuloActivo === 'estructura' && <Estructura />}
                            {subModuloActivo === 'contratos' && <Contratos />}
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9ca3af', fontSize: '18px' }}>
                        Vista de {menuPrincipal.toUpperCase()} - Espacio de trabajo asignado a tus compañeros de equipo.
                    </div>
                )}
            </div>
        </div>
    );
}

const sidebarBtnStyle = {
    width: '100%', textAlign: 'left' as const, padding: '12px 15px', background: 'none', border: 'none',
    color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.2s'
};

const activeTabStyle = {
    padding: '8px 20px', backgroundColor: '#1A1C4b', color: '#fff', border: 'none',
    borderRadius: '20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
};

const inactiveTabStyle = {
    padding: '8px 20px', backgroundColor: '#e5e7eb', color: '#4b5563', border: 'none',
    borderRadius: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s'
};