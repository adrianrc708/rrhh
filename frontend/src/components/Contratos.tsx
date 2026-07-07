import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors } from '../theme';
import { Card, Field, Select, Btn, Badge, Loading, Empty, tableStyles, useToast, inputStyle } from './ui';

export default function Contratos() {
    const toast = useToast();
    const [empleados, setEmpleados] = useState([]);
    const [contratos, setContratos] = useState([]);
    const [cargando, setCargando] = useState(true);

    // Form states
    const [empleadoId, setEmpleadoId] = useState('');
    const [tipoContrato, setTipoContrato] = useState('Plazo Fijo (Temporal)');
    const [perfil, setPerfil] = useState('Comun');   // Fase 2: perfil sectorial
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
            toast('warning', 'Por favor, rellene los campos obligatorios.');
            return;
        }

        try {
            await api.post('/empleados/contratos', {
                empleado_id: Number(empleadoId),
                tipo_contrato: tipoContrato,
                perfil_contrato: perfil,
                sueldo_base: Number(sueldoBase),
                horas_contrato_mes: Number(horasMes),
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin || null
            });

            setEmpleadoId('');
            setFechaInicio('');
            setFechaFin('');
            cargarDatosContratos();
            toast('success', 'Contrato laboral emitido exitosamente.');
        } catch (err) {
            console.error("Error al emitir contrato:", err);
            toast('error', 'No se pudo registrar el contrato laboral.');
        }
    };

    const obtenerNombreEmpleado = (id: number) => {
        const emp = empleados.find((e: any) => e.empleado_id === id);
        return emp ? emp.nombre : `Empleado ID ${id}`;
    };

    return (
        <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: colors.textStrong }}>Gestión de Contratos y Condiciones Laborales</h3>
            <p style={{ color: colors.textMuted, fontSize: 13, margin: '0 0 20px' }}>Control de vigencias, remuneraciones base y jornadas horarias pactadas.</p>

            {cargando ? (
                <Loading text="Sincronizando historial de contratos…" />
            ) : (
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                    {/* Formulario de Emisión */}
                    <Card style={{ width: 320, flexShrink: 0 }}>
                        <form onSubmit={handleCrearContrato} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <strong style={{ fontSize: 14, color: colors.textStrong }}>Generar nuevo contrato</strong>

                            <Field label="Seleccionar colaborador">
                                <Select value={empleadoId} onChange={setEmpleadoId} required>
                                    <option value="">-- Seleccione un empleado --</option>
                                    {empleados.map((e: any) => (
                                        <option key={e.empleado_id} value={e.empleado_id}>
                                            {e.nombre || `ID: ${e.empleado_id}`} ({e.estado})
                                        </option>
                                    ))}
                                </Select>
                            </Field>

                            <Field label="Tipo de contrato">
                                <Select value={tipoContrato} onChange={setTipoContrato}>
                                    <option value="Plazo Fijo (Temporal)">Plazo Fijo (Temporal)</option>
                                    <option value="Indeterminado">Indeterminado</option>
                                    <option value="Part-Time">Part-Time</option>
                                    <option value="Por Locación de Servicios">Por Locación de Servicios</option>
                                </Select>
                            </Field>

                            <Field label="Perfil / régimen sectorial">
                                <Select value={perfil} onChange={setPerfil}>
                                    <option value="Comun">Común</option>
                                    <option value="Minero">Minero</option>
                                    <option value="Agrario">Agrario</option>
                                    <option value="Construccion">Construcción</option>
                                    <option value="PartTime">Part-Time (proporcional)</option>
                                </Select>
                            </Field>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Field label="Sueldo base (S/.)">
                                        <input type="number" value={sueldoBase} onChange={(e) => setSueldoBase(e.target.value)} style={inputStyle} required />
                                    </Field>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Field label="Horas al mes">
                                        <input type="number" value={horasMes} onChange={(e) => setHorasMes(e.target.value)} style={inputStyle} required />
                                    </Field>
                                </div>
                            </div>

                            <Field label="Fecha inicio">
                                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} required />
                            </Field>

                            <Field label="Fecha fin (opcional)">
                                <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle} />
                            </Field>

                            <Btn type="submit" icon="plus" style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}>Emitir Contrato</Btn>
                        </form>
                    </Card>

                    {/* Historial Visual */}
                    <Card style={{ flex: 1, minWidth: 320 }}>
                        <strong style={{ fontSize: 14, color: colors.textStrong, display: 'block', marginBottom: 16 }}>Registro histórico de vigencias</strong>
                        {contratos.length === 0 ? <Empty text="Aún no se han emitido contratos." /> : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={tableStyles.table}>
                                    <thead>
                                        <tr>
                                            <th style={tableStyles.th}>ID</th>
                                            <th style={tableStyles.th}>Colaborador</th>
                                            <th style={tableStyles.th}>Tipo</th>
                                            <th style={tableStyles.th}>Perfil</th>
                                            <th style={tableStyles.th}>Sueldo base</th>
                                            <th style={tableStyles.th}>Vigencia</th>
                                            <th style={{ ...tableStyles.th, textAlign: 'center' }}>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {contratos.map((con: any) => (
                                            <tr key={con.contrato_id}>
                                                <td style={{ ...tableStyles.td, fontWeight: 700, color: colors.textStrong }}>{con.contrato_id}</td>
                                                <td style={{ ...tableStyles.td, fontWeight: 600, color: colors.textStrong }}>{obtenerNombreEmpleado(con.empleado_id)}</td>
                                                <td style={tableStyles.td}>{con.tipo_contrato}</td>
                                                <td style={tableStyles.td}>
                                                    <Badge tone={con.perfil_contrato && con.perfil_contrato !== 'Comun' ? 'amber' : 'gray'}>{con.perfil_contrato || 'Comun'}</Badge>
                                                </td>
                                                <td style={{ ...tableStyles.td, color: colors.green, fontWeight: 700 }}>S/. {con.sueldo_base}</td>
                                                <td style={{ ...tableStyles.td, color: colors.textMuted }}>{con.fecha_inicio} al {con.fecha_fin || 'Indefinido'}</td>
                                                <td style={{ ...tableStyles.td, textAlign: 'center' }}>
                                                    <Badge tone={con.estado === 'Vigente' ? 'green' : 'red'}>{con.estado}</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>

                </div>
            )}
        </div>
    );
}
