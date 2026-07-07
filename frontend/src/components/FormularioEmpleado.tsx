import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors } from '../theme';
import { Modal, Field, Select, Btn, useToast, inputStyle } from './ui';

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
        <Modal title={empleadoAEditar ? 'Modificar Datos de Colaborador' : 'Registrar Nuevo Colaborador'} onClose={onClose} width={480}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                <Field label="Nombre completo">
                    <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required style={inputStyle} placeholder="Ej. Juan Pérez Ramos" />
                </Field>

                {/* INTERFAZ CONDICIONAL INTELIGENTE PARA EL ID DE USUARIO ACCOUNT */}
                {!empleadoAEditar ? (
                    <Field label="Asociar cuenta de usuario Core">
                        <Select value={usuarioId} onChange={setUsuarioId} required>
                            <option value="">-- Seleccionar cuenta del sistema --</option>
                            {usuariosDisponibles.map((u: any) => (
                                <option key={u.usuario_id} value={u.usuario_id}>
                                    {u.nombre} ({u.correo})
                                </option>
                            ))}
                        </Select>
                    </Field>
                ) : (
                    // En modo de edición el campo desaparece de la vista protegiendo la inmutabilidad de la relación
                    <input type="hidden" value={usuarioId} />
                )}

                {/* SELECTORES DE CONTROL EN CASCADA COMPLETA */}
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Field label="Departamento / Área">
                            <Select
                                value={departamentoId}
                                onChange={(v) => { setDepartamentoId(v); setCargoId(''); }}
                                required
                            >
                                <option value="">-- Seleccionar --</option>
                                {departamentos.map((d: any) => (
                                    <option key={d.departamento_id} value={d.departamento_id}>{d.nombre}</option>
                                ))}
                            </Select>
                        </Field>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Field label="Cargo / Puesto">
                            <Select
                                value={cargoId}
                                onChange={setCargoId}
                                required
                                disabled={!departamentoId}
                            >
                                <option value="">-- Seleccionar --</option>
                                {cargosFiltrados.map((c: any) => (
                                    <option key={c.cargo_id} value={c.cargo_id}>{c.nombre}</option>
                                ))}
                            </Select>
                        </Field>
                    </div>
                </div>

                {/* Datos provisionales y administrativos */}
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Field label="Régimen de pensión">
                            <Select value={tipoPension} onChange={setTipoPension}>
                                <option value="ONP">ONP (Sistema Público)</option>
                                <option value="AFP Prima">AFP Prima</option>
                                <option value="AFP Integra">AFP Integra</option>
                                <option value="AFP Profuturo">AFP Profuturo</option>
                            </Select>
                        </Field>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Field label="Fecha de ingreso">
                            <input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} required style={inputStyle} />
                        </Field>
                    </div>
                </div>

                {/* Botoneras */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
                    <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
                    <Btn type="submit">{empleadoAEditar ? 'Guardar Cambios' : 'Registrar Colaborador'}</Btn>
                </div>

            </form>
        </Modal>
    );
}
