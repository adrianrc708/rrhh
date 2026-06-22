import React, { useEffect, useState } from 'react';
import api from '../services/api';
import FormularioEmpleado from './FormularioEmpleado';
import Estructura from './Estructura';
import Contratos from './Contratos'; // <-- AÑADIDO: Importación del nuevo módulo

export default function Directorio() {
    const [empleados, setEmpleados] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [cargos, setCargos] = useState([]);
    const [cargando, setCargando] = useState(true);

    // MODIFICADO: Se añade 'contratos' al discriminador de tipos del estado
    const [pestanaActiva, setPestanaActiva] = useState<'empleados' | 'estructura' | 'contratos'>('empleados');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<any | null>(null);

    const cargarDatosDelPanel = async () => {
        setCargando(true);
        try {
            const [resEmpleados, resDepts, resCargos] = await Promise.all([
                api.get('/empleados/'),
                api.get('/empleados/departamentos'),
                api.get('/empleados/cargos')
            ]);
            setEmpleados(resEmpleados.data);
            setDepartamentos(resDepts.data);
            setCargos(resCargos.data);
        } catch (err) {
            console.error("Error al obtener el directorio", err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarDatosDelPanel();
    }, []);

    const obtenerNombreDepartamento = (id: number) => {
        const dept: any = departamentos.find((d: any) => d.departamento_id == id);
        return dept ? dept.nombre : 'No asignado';
    };

    const obtenerNombreCargo = (id: number) => {
        const cargo: any = cargos.find((c: any) => c.cargo_id == id);
        return cargo ? cargo.nombre : 'No asignado';
    };

    const abrirAlta = () => {
        setEmpleadoSeleccionado(null);
        setIsModalOpen(true);
    };

    const abrirEdicion = (emp: any) => {
        setEmpleadoSeleccionado(emp);
        setIsModalOpen(true);
    };

    const handleBaja = async (emp: any) => {
        if (window.confirm(`¿Estás seguro de que deseas dar de baja al empleado con ID ${emp.empleado_id}?`)) {
            try {
                await api.patch(`/empleados/${emp.empleado_id}`, { estado: 'Inactivo' });
                cargarDatosDelPanel();
            } catch (err) {
                console.error("Error al dar de baja", err);
                alert("No se pudo procesar la baja del colaborador.");
            }
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login';
    };

    const obtenerUsuarioSeguro = () => {
        const dataGuardada = localStorage.getItem('user');
        if (!dataGuardada || dataGuardada === 'undefined') {
            return { nombre: 'Colaborador Omnia', rol: 'Personal' };
        }
        try {
            return JSON.parse(dataGuardada);
        } catch {
            return { nombre: 'Colaborador Omnia', rol: 'Personal' };
        }
    };

    const user = obtenerUsuarioSeguro();

    return (
        <div style={{ padding: '30px', fontFamily: 'sans-serif', backgroundColor: '#f3f4f6', minHeight: '100vh' }}>

            {/* 1. Barra Superior */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#1f2937' }}>Panel de Gestión Humana — Omnia HR</h2>
                    <p style={{ margin: '5px 0 0 0', color: '#4b5563', fontSize: '14px' }}>
                        Sesión activa: <strong style={{ color: '#2563eb' }}>{user.nombre}</strong> — Rol: <span style={{ backgroundColor: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{user.rol}</span>
                    </p>
                </div>
                <button onClick={handleLogout} style={{ padding: '10px 18px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                    Cerrar Sesión
                </button>
            </div>

            {/* 2. Menú de Navegación por Pestañas */}
            <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #e5e7eb', marginBottom: '25px', paddingBottom: '2px' }}>
                <button onClick={() => setPestanaActiva('empleados')} style={{ padding: '12px 24px', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', backgroundColor: pestanaActiva === 'empleados' ? '#2563eb' : '#e5e7eb', color: pestanaActiva === 'empleados' ? '#fff' : '#4b5563', transition: 'all 0.2s' }}>
                    Directorio de Personal
                </button>
                <button onClick={() => setPestanaActiva('estructura')} style={{ padding: '12px 24px', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', backgroundColor: pestanaActiva === 'estructura' ? '#2563eb' : '#e5e7eb', color: pestanaActiva === 'estructura' ? '#fff' : '#4b5563', transition: 'all 0.2s' }}>
                    Estructura Organizacional
                </button>
                {/* NUEVO BOTÓN: Acceso directo a la vista de contratos firmados */}
                <button onClick={() => setPestanaActiva('contratos')} style={{ padding: '12px 24px', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', backgroundColor: pestanaActiva === 'contratos' ? '#2563eb' : '#e5e7eb', color: pestanaActiva === 'contratos' ? '#fff' : '#4b5563', transition: 'all 0.2s' }}>
                    Gestión de Contratos
                </button>
            </div>

            {/* 3. Renderizado Dinámico de Vistas */}
            {pestanaActiva === 'empleados' ? (
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, color: '#1f2937' }}>Listado General de Colaboradores</h3>
                        <button onClick={abrirAlta} style={{ padding: '10px 15px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                            + Registrar Nuevo Colaborador
                        </button>
                    </div>

                    {cargando ? (
                        <p style={{ color: '#6b7280' }}>Cargando información del personal corporativo...</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                    <th style={{ padding: '12px', color: '#4b5563' }}>ID Empleado</th>
                                    <th style={{ padding: '12px', color: '#4b5563' }}>Nombre / Colaborador</th>
                                    <th style={{ padding: '12px', color: '#4b5563' }}>Departamento / Área</th>
                                    <th style={{ padding: '12px', color: '#4b5563' }}>Puesto / Cargo</th>
                                    <th style={{ padding: '12px', color: '#4b5563' }}>Tipo Pensión</th>
                                    <th style={{ padding: '12px', color: '#4b5563' }}>Fecha Ingreso</th>
                                    <th style={{ padding: '12px', color: '#4b5563' }}>Estado</th>
                                    <th style={{ padding: '12px', color: '#4b5563', textAlign: 'center' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {empleados.map((emp: any) => (
                                    <tr key={emp.empleado_id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background-color 0.15s' }}>
                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{emp.empleado_id}</td>
                                        <td style={{ padding: '12px', color: '#1f2937', fontWeight: 'bold' }}>{emp.nombre || `Colaborador ${emp.empleado_id}`}</td>
                                        <td style={{ padding: '12px', color: '#1e3a8a', fontWeight: '500' }}>{obtenerNombreDepartamento(emp.departamento_id)}</td>
                                        <td style={{ padding: '12px', color: '#10b981', fontWeight: '500' }}>{obtenerNombreCargo(emp.cargo_id)}</td>
                                        <td style={{ padding: '12px' }}>{emp.tipo_pension}</td>
                                        <td style={{ padding: '12px' }}>{emp.fecha_ingreso}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{ backgroundColor: emp.estado === 'Activo' ? '#d1fae5' : '#fee2e2', color: emp.estado === 'Activo' ? '#065f46' : '#991b1b', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                                                {emp.estado}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button
                                                onClick={() => abrirEdicion(emp)}
                                                style={{ padding: '5px 12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                                            >
                                                Editar
                                            </button>

                                            {/* RENDERIZADO CONDICIONAL DE ALTAS Y BAJAS */}
                                            {emp.estado === 'Activo' ? (
                                                <button
                                                    onClick={() => handleBaja(emp)}
                                                    style={{ padding: '5px 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                                                >
                                                    Baja
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={async () => {
                                                        if (window.confirm(`¿Deseas reactivar y dar de alta nuevamente al colaborador con ID ${emp.empleado_id}?`)) {
                                                            try {
                                                                // Enviamos el cambio de estado opuesto al endpoint unificado
                                                                await api.patch(`/empleados/${emp.empleado_id}`, { estado: 'Activo' });
                                                                cargarDatosDelPanel(); // Recarga la tabla de inmediato
                                                            } catch (err) {
                                                                console.error("Error al dar de alta", err);
                                                                alert("No se pudo procesar el alta del colaborador.");
                                                            }
                                                        }
                                                    }}
                                                    style={{ padding: '5px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                                                >
                                                    Alta
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : pestanaActiva === 'estructura' ? (
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <Estructura />
                </div>
            ) : (
                // NUEVA CONDICIÓN: Renderiza el módulo relacional de contratos
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <Contratos />
                </div>
            )}

            <FormularioEmpleado isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={cargarDatosDelPanel} empleadoAEditar={empleadoSeleccionado} />
        </div>
    );
}