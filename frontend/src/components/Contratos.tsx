import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Contratos() {
    const [empleados, setEmpleados] = useState([]);
    const [contratos, setContratos] = useState([]);
    const [cargando, setCargando] = useState(true);

    // Form states
    const [empleadoId, setEmpleadoId] = useState('');
    const [tipoContrato, setTipoContrato] = useState('Plazo Fijo (Temporal)');
    const [sueldoBase, setSueldoBase] = useState('1025');
    const [horasMes, setHorasMes] = useState('160');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');

    const cargarDatosContratos = async () => {
        try {
            const [resEmp, resContratos] = await Promise.all([
                api.get('/empleados/'),
                api.get('/empleados/contratos')
            ]);
            setEmpleados(resEmp.data);
            setContratos(resContratos.data);
        } catch (err) {
            console.error("Error al sincronizar datos contractuales:", err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarDatosContratos();
    }, []);

    const handleCrearContrato = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empleadoId || !fechaInicio) {
            alert("Por favor, rellene los campos obligatorios.");
            return;
        }

        try {
            await api.post('/empleados/contratos', {
                empleado_id: Number(empleadoId),
                tipo_contrato: tipoContrato,
                sueldo_base: Number(sueldoBase),
                horas_contrato_mes: Number(horasMes),
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin || null
            });

            // Resetear formulario y recargar
            setEmpleadoId('');
            setFechaInicio('');
            setFechaFin('');
            cargarDatosContratos();
            alert("Contrato laboral emitido exitosamente.");
        } catch (err) {
            console.error("Error al emitir contrato:", err);
            alert("No se pudo registrar el contrato laboral.");
        }
    };

    const obtenerNombreEmpleado = (id: number) => {
        const emp = empleados.find((e: any) => e.empleado_id === id);
        return emp ? emp.nombre : `Empleado ID ${id}`;
    };

    return (
        <div style={{ fontFamily: 'sans-serif', marginTop: '10px' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '20px', color: '#111827' }}>Gestión de Contratos y Condiciones Laborales</h3>
            {/* 🔥 MODIFICADO: Se removió la etiqueta (RF-06) */}
            <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px 0' }}>Control de vigencias, remuneraciones base y jornadas horarias pactadas.</p>

            {cargando ? (
                <p style={{ color: '#6b7280' }}>Sincronizando historial de contratos...</p>
            ) : (
                <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>

                    {/* Formulario de Emisión */}
                    <form onSubmit={handleCrearContrato} style={{ width: '320px', backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <strong style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>Generar Nuevo Contrato</strong>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Seleccionar Colaborador:</label>
                            <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#fff', fontSize: '13px' }} required>
                                <option value="">-- Seleccione un empleado --</option>
                                {empleados.map((e: any) => (
                                    <option key={e.empleado_id} value={e.empleado_id}>
                                        {e.nombre || `ID: ${e.empleado_id}`} ({e.estado})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Tipo de Contrato:</label>
                            <select value={tipoContrato} onChange={(e) => setTipoContrato(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#fff', fontSize: '13px' }}>
                                <option value="Plazo Fijo (Temporal)">Plazo Fijo (Temporal)</option>
                                <option value="Indeterminado">Indeterminado</option>
                                <option value="Part-Time">Part-Time</option>
                                <option value="Por Locación de Servicios">Por Locación de Servicios</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Sueldo Base (S/.):</label>
                                <input type="number" value={sueldoBase} onChange={(e) => setSueldoBase(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} required />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Horas al Mes:</label>
                                <input type="number" value={horasMes} onChange={(e) => setHorasMes(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} required />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Fecha Inicio:</label>
                            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} required />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>Fecha Fin (Opcional):</label>
                            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                        </div>

                        {/* 🔥 MODIFICADO: Color cambiado a naranja de la plataforma */}
                        <button type="submit" style={{ marginTop: '8px', padding: '10px', backgroundColor: '#f97316', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                            + Emitir Contrato
                        </button>
                    </form>

                    {/* Historial Visual */}
                    <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
                        <strong style={{ fontSize: '14px', color: '#374151', display: 'block', marginBottom: '15px' }}>Registro Histórico de Vigencias</strong>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontWeight: 'bold' }}>
                                    <th style={{ padding: '10px 5px' }}>ID</th>
                                    <th style={{ padding: '10px 5px' }}>Colaborador</th>
                                    <th style={{ padding: '10px 5px' }}>Régimen</th>
                                    <th style={{ padding: '10px 5px' }}>Sueldo Base</th>
                                    <th style={{ padding: '10px 5px' }}>Vigencia</th>
                                    <th style={{ padding: '10px 5px', textAlign: 'center' }}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contratos.map((con: any) => (
                                    <tr key={con.contrato_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '12px 5px', fontWeight: 'bold' }}>{con.contrato_id}</td>
                                        <td style={{ padding: '12px 5px', fontWeight: '600' }}>{obtenerNombreEmpleado(con.empleado_id)}</td>
                                        <td style={{ padding: '12px 5px', color: '#4b5563' }}>{con.tipo_contrato}</td>
                                        <td style={{ padding: '12px 5px', color: '#10b981', fontWeight: 'bold' }}>S/. {con.sueldo_base}</td>
                                        <td style={{ padding: '12px 5px', color: '#6b7280' }}>{con.fecha_inicio} al {con.fecha_fin || 'Indefinido'}</td>
                                        <td style={{ padding: '12px 5px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '3px 8px',
                                                backgroundColor: con.estado === 'Vigente' ? '#d1fae5' : '#fee2e2',
                                                color: con.estado === 'Vigente' ? '#065f46' : '#991b1b',
                                                borderRadius: '10px', fontSize: '11px', fontWeight: 'bold'
                                            }}>
                                                {con.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                </div>
            )}
        </div>
    );
}