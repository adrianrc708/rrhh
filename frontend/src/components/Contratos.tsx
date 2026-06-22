import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Contratos() {
    const [contratos, setContratos] = useState([]);
    const [empleados, setEmpleados] = useState([]);
    const [cargando, setCargando] = useState(true);

    // Estados para el formulario de nuevo contrato
    const [empleadoId, setEmpleadoId] = useState('');
    const [tipoContrato, setTipoContrato] = useState('Plazo Fijo');
    const [sueldoBase, setSueldoBase] = useState('');
    const [horasMes, setHorasMes] = useState('160');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');

    const cargarDatosContratos = async () => {
        setCargando(true);
        try {
            // Consultas en paralelo alineadas a tus endpoints del backend
            const [resContratos, resEmpleados] = await Promise.all([
                api.get('/empleados/contratos'),
                api.get('/empleados/')
            ]);
            setContratos(resContratos.data);
            setEmpleados(resEmpleados.data);
        } catch (err) {
            console.error("Error al cargar el historial de contratos:", err);
            // Fallback preventivo si el endpoint get general de contratos aún no tiene registros
            setContratos([]);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarDatosContratos();
    }, []);

    const obtenerNombreEmpleado = (id: number) => {
        const emp: any = empleados.find((e: any) => e.empleado_id === id);
        return emp ? (emp.nombre || `Empleado ID ${id}`) : `Empleado ID ${id}`;
    };

    const handleCrearContrato = async (e: React.FormEvent) => {
        e.preventDefault();

        // Construimos el payload tipado según el esquema ContratoCreate de Pydantic
        const payload = {
            empleado_id: Number(empleadoId),
            tipo_contrato: tipoContrato,
            sueldo_base: Number(sueldoBase),
            horas_contract_mes: Number(horasMes),
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin || null // Opcional para contratos indefinidos
        };

        try {
            await api.post('/empleados/contratos', payload);

            // Limpiamos el formulario tras un registro exitoso
            setEmpleadoId('');
            setSueldoBase('');
            setFechaInicio('');
            setFechaFin('');

            // Recargamos la lista actualizada
            cargarDatosContratos();
            alert("Contrato laboral registrado exitosamente.");
        } catch (err) {
            console.error("Error al registrar contrato:", err);
            alert("No se pudo registrar el contrato. Verifica los datos o la conexión.");
        }
    };

    return (
        <div style={{ fontFamily: 'sans-serif', marginTop: '20px' }}>
            <h3>Gestión de Contratos y Condiciones Laborales</h3>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Control de vigencias, remuneraciones base y jornadas horarias pactadas (RF-06).</p>

            <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

                {/* Formulario de Alta de Contratos - Optimizado con ancho seguro */}
                <form onSubmit={handleCrearContrato} style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', width: '360px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                    <strong style={{ fontSize: '14px', color: '#374151' }}>Generar Nuevo Contrato</strong>

                    {/* Selector de Colaborador con ancho blindado a 100% */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Seleccionar Colaborador:</label>
                        <select
                            value={empleadoId}
                            onChange={(e) => setEmpleadoId(e.target.value)}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#fff', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                            required
                        >
                            <option value="">-- Seleccione un empleado --</option>
                            {empleados.map((emp: any) => (
                                <option key={emp.empleado_id} value={emp.empleado_id}>
                                    {emp.nombre || `ID ${emp.empleado_id}`} (ID: {emp.usuario_id})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Selector de Tipo de Contrato con ancho blindado a 100% */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Tipo de Contrato:</label>
                        <select
                            value={tipoContrato}
                            onChange={(e) => setTipoContrato(e.target.value)}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#fff', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                        >
                            <option value="Plazo Fijo">Plazo Fijo (Temporal)</option>
                            <option value="Indefinido">Indefinido</option>
                            <option value="Part-Time">Part-Time</option>
                            <option value="Locación de Servicios">Locación de Servicios</option>
                        </select>
                    </div>

                    {/* Fila flexible perfectamente equilibrada */}
                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Sueldo Base (S/.):</label>
                            <input
                                type="number"
                                value={sueldoBase}
                                onChange={(e) => setSueldoBase(e.target.value)}
                                placeholder="1025"
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Horas al Mes:</label>
                            <input
                                type="number"
                                value={horasMes}
                                onChange={(e) => setHorasMes(e.target.value)}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                                required
                            />
                        </div>
                    </div>

                    {/* Inputs de fecha adaptados al contenedor */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Fecha Inicio:</label>
                        <input
                            type="date"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Fecha Fin (Opcional):</label>
                        <input
                            type="date"
                            value={fechaFin}
                            onChange={(e) => setFechaFin(e.target.value)}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>

                    <button
                        type="submit"
                        style={{ marginTop: '10px', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                    >
                        + Emitir Contrato
                    </button>
                </form>

                {/* Historial General de Contratos Emitidos */}
                <div style={{ flex: 1, backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minWidth: '400px' }}>
                    <strong style={{ display: 'block', marginBottom: '15px', color: '#1f2937' }}>Registro Histórico de Vigencias</strong>

                    {cargando ? (
                        <p style={{ color: '#6b7280', fontSize: '14px' }}>Buscando contratos activos...</p>
                    ) : contratos.length === 0 ? (
                        <p style={{ color: '#9ca3af', fontSize: '14px', fontStyle: 'italic' }}>No se registran contratos vigentes en el sistema actualmente.</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                    <th style={{ padding: '10px', color: '#4b5563' }}>ID</th>
                                    <th style={{ padding: '10px', color: '#4b5563' }}>Colaborador</th>
                                    <th style={{ padding: '10px', color: '#4b5563' }}>Régimen</th>
                                    <th style={{ padding: '10px', color: '#4b5563' }}>Sueldo Base</th>
                                    <th style={{ padding: '10px', color: '#4b5563' }}>Vigencia</th>
                                    <th style={{ padding: '10px', color: '#4b5563', textAlign: 'center' }}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contratos.map((con: any) => (
                                    <tr key={con.contrato_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{con.contrato_id}</td>
                                        <td style={{ padding: '10px', color: '#1f2937', fontWeight: 'bold' }}>{obtenerNombreEmpleado(con.empleado_id)}</td>
                                        <td style={{ padding: '10px' }}>{con.tipo_contrato}</td>
                                        <td style={{ padding: '10px', fontWeight: '500', color: '#059669' }}>S/. {con.sueldo_base}</td>
                                        <td style={{ padding: '10px', color: '#4b5563' }}>
                                            {con.fecha_inicio} al {con.fecha_fin || 'Indefinido'}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            <span style={{
                                                backgroundColor: con.estado === 'Vigente' ? '#d1fae5' : '#fee2e2',
                                                color: con.estado === 'Vigente' ? '#065f46' : '#991b1b',
                                                padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
                                            }}>
                                                {con.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

            </div>
        </div>
    );
}