import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from './ui';

interface FormularioProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    empleadoAEditar: any | null;
}

export default function FormularioEmpleado({ isOpen, onClose, onSave, empleadoAEditar }: FormularioProps) {
    const toast = useToast();
    const [nombre, setNombre] = useState('');
    const [usuarioId, setUsuarioId] = useState('');
    const [departamentoId, setDepartamentoId] = useState('');
    const [cargoId, setCargoId] = useState('');
    const [tipoPension, setTipoPension] = useState('ONP');
    const [fechaIngreso, setFechaIngreso] = useState('');

    // Listas relacionales de la base de datos
    const [departamentos, setDepartamentos] = useState([]);
    const [cargos, setCargos] = useState([]);
    const [usuariosDisponibles, setUsuariosDisponibles] = useState([]); // <-- NUEVO: Estado para usuarios libres

    useEffect(() => {
        const cargarListasRelacionales = async () => {
            try {
                const [resDept, resCargos] = await Promise.all([
                    api.get('/empleados/departamentos'),
                    api.get('/empleados/cargos')
                ]);
                setDepartamentos(resDept.data);
                setCargos(resCargos.data);
            } catch (error) {
                console.error("Error cargando listas de estructura:", error);
            }
        };
        if (isOpen) {
            cargarListasRelacionales();
        }
    }, [isOpen]);

    // Consultamos los usuarios libres únicamente al abrir el formulario en modo de alta (Registro nuevo)
    useEffect(() => {
        const cargarUsuariosLibres = async () => {
            try {
                const resUsuarios = await api.get('/empleados/usuarios-disponibles');
                setUsuariosDisponibles(resUsuarios.data);
            } catch (error) {
                console.error("Error al mapear cuentas de usuario libres:", error);
            }
        };

        if (isOpen && !empleadoAEditar) {
            cargarUsuariosLibres();
        }
    }, [isOpen, empleadoAEditar]);

    useEffect(() => {
        if (isOpen) {
            if (empleadoAEditar) {
                setNombre(empleadoAEditar.nombre || '');
                setUsuarioId(empleadoAEditar.usuario_id || '');
                setDepartamentoId(empleadoAEditar.departamento_id || '');
                setCargoId(empleadoAEditar.cargo_id || '');
                setTipoPension(empleadoAEditar.tipo_pension || 'ONP');
                setFechaIngreso(empleadoAEditar.fecha_ingreso || '');
            } else {
                setNombre('');
                setUsuarioId('');
                setDepartamentoId('');
                setCargoId('');
                setTipoPension('ONP');
                setFechaIngreso('');
            }
        }
    }, [empleadoAEditar, isOpen]);

    if (!isOpen) return null;

    // LÓGICA DE CASCADA: Filtramos puestos de trabajo de acuerdo al área seleccionada
    const cargosFiltrados = cargos.filter((c: any) => c.departamento_id === Number(departamentoId));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            nombre: nombre.trim(),
            usuario_id: Number(usuarioId),
            departamento_id: Number(departamentoId),
            cargo_id: Number(cargoId),
            tipo_pension: tipoPension,
            fecha_ingreso: fechaIngreso
        };

        try {
            if (empleadoAEditar) {
                await api.patch(`/empleados/${empleadoAEditar.empleado_id}`, payload);
            } else {
                await api.post('/empleados/', payload);
            }
            toast('success', empleadoAEditar ? 'Datos del colaborador actualizados.' : 'Colaborador registrado exitosamente.');
            onSave();
            onClose();
        } catch (err: any) {
            toast('error', 'No se pudo registrar la información. Revisa la integridad del backend.');
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', width: '450px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', fontFamily: 'sans-serif' }}>

                <h3 style={{ margin: '0 0 20px 0', color: '#1f2937', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>
                    {empleadoAEditar ? 'Modificar Datos de Colaborador' : 'Registrar Nuevo Colaborador'}
                </h3>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                    {/* Campo de Nombre descriptivo */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>Nombre Completo:</label>
                        <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '14px' }} placeholder="Ej. Juan Pérez Ramos" />
                    </div>

                    {/* INTERFAZ CONDICIONAL INTELIGENTE PARA EL ID DE USUARIO ACCOUNT */}
                    {!empleadoAEditar ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>Asociar Cuenta de Usuario Core:</label>
                            <select
                                value={usuarioId}
                                onChange={(e) => setUsuarioId(e.target.value)}
                                required
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#fff', fontSize: '14px' }}
                            >
                                <option value="">-- Seleccionar cuenta del sistema --</option>
                                {usuariosDisponibles.map((u: any) => (
                                    <option key={u.usuario_id} value={u.usuario_id}>
                                        {u.nombre} ({u.correo})
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        // En modo de edición el campo desaparece de la vista protegiendo la inmutabilidad de la relación
                        <input type="hidden" value={usuarioId} />
                    )}

                    {/* SELECTORES DE CONTROL EN CASCADA COMPLETA */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>Departamento / Área:</label>
                            <select
                                value={departamentoId}
                                onChange={(e) => {
                                    setDepartamentoId(e.target.value);
                                    setCargoId(''); // Limpiamos el cargo subordinado de inmediato
                                }}
                                required
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#fff', fontSize: '14px' }}
                            >
                                <option value="">-- Seleccionar --</option>
                                {departamentos.map((d: any) => (
                                    <option key={d.departamento_id} value={d.departamento_id}>{d.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>Cargo / Puesto:</label>
                            <select
                                value={cargoId}
                                onChange={(e) => setCargoId(e.target.value)}
                                required
                                disabled={!departamentoId} // Desactivado si no hay departamento seleccionado
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: departamentoId ? '#fff' : '#f3f4f6', fontSize: '14px' }}
                            >
                                <option value="">-- Seleccionar --</option>
                                {cargosFiltrados.map((c: any) => (
                                    <option key={c.cargo_id} value={c.cargo_id}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Datos provisionales y administrativos */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>Régimen de Pensión:</label>
                            <select value={tipoPension} onChange={(e) => setTipoPension(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#fff', fontSize: '14px' }}>
                                <option value="ONP">ONP (Sistema Público)</option>
                                <option value="AFP Prima">AFP Prima</option>
                                <option value="AFP Integra">AFP Integra</option>
                                <option value="AFP Profuturo">AFP Profuturo</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>Fecha de Ingreso:</label>
                            <input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '14px' }} />
                        </div>
                    </div>

                    {/* Botoneras */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px', borderTop: '1px solid #e5e7eb', paddingTop: '15px' }}>
                        <button type="button" onClick={onClose} style={{ padding: '10px 16px', backgroundColor: '#fff', color: '#374151', border: '1px solid #EAECF2', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#F97316', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>{empleadoAEditar ? 'Guardar Cambios' : 'Registrar Colaborador'}</button>
                    </div>

                </form>
            </div>
        </div>
    );
}