import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from './ui';

export default function Estructura() {
    const toast = useToast();
    const [departamentos, setDepartamentos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [nuevoDept, setNuevoDept] = useState('');

    const [deptIdSeleccionadoForCargo, setDeptIdSeleccionadoForCargo] = useState<number | null>(null);
    const [nuevoCargoNombre, setNuevoCargoNombre] = useState('');
    const [cargoParentId, setCargoParentId] = useState('');

    const cargarEstructura = async () => {
        try {
            const [resDept, resCargos, resEmpleados] = await Promise.all([
                api.get('/empleados/departamentos'),
                api.get('/empleados/cargos'),
                api.get('/empleados/')
            ]);

            const estructuraCompleta = resDept.data.map((dept: any) => {
                const deptoCargos = resCargos.data.filter((c: any) => c.departamento_id === dept.departamento_id);

                return {
                    ...dept,
                    cargos: deptoCargos.map((cargo: any) => ({
                        ...cargo,
                        colaboradoresAsignados: resEmpleados.data.filter((e: any) => e.cargo_id === cargo.cargo_id)
                    }))
                };
            });

            setDepartamentos(estructuraCompleta);
        } catch (err) {
            console.error("Error al sincronizar el organigrama corporativo:", err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarEstructura();
    }, []);

    const obtenerNombreCargoPadre = (cargosDelDept: any[], pId: number | null) => {
        if (!pId) return null;
        const padre = cargosDelDept.find((c: any) => c.cargo_id === pId);
        return padre ? padre.nombre : null;
    };

    const handleCrearDepartamento = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nuevoDept.trim()) return;

        try {
            await api.post('/empleados/departamentos', { nombre: nuevoDept.trim() });
            setNuevoDept('');
            cargarEstructura();
            toast('success', 'Departamento creado correctamente.');
        } catch (err: any) {
            console.error("Error al crear departamento:", err);
            toast('error', 'No se pudo crear el departamento.');
        }
    };

    const handleCrearCargo = async (e: React.FormEvent, deptoId: number) => {
        e.preventDefault();
        if (!nuevoCargoNombre.trim()) return;

        try {
            await api.post('/empleados/cargos', {
                nombre: nuevoCargoNombre.trim(),
                departamento_id: deptoId,
                parent_id: cargoParentId ? Number(cargoParentId) : null
            });
            setNuevoCargoNombre('');
            setCargoParentId('');
            setDeptIdSeleccionadoForCargo(null);
            cargarEstructura();
            toast('success', 'Cargo registrado correctamente.');
        } catch (err) {
            console.error("Error al registrar puesto laboral:", err);
            toast('error', 'No se pudo registrar el nuevo cargo.');
        }
    };

    const handleEliminarDepartamento = async (id: number, nombre: string) => {
        if (window.confirm(`¿Estás seguro de que deseas eliminar el departamento: ${nombre}?`)) {
            try {
                await api.delete(`/empleados/departamentos/${id}`);
                cargarEstructura();
                toast('success', 'Departamento eliminado correctamente.');
            } catch (err) {
                console.error("Error al eliminar:", err);
                toast('error', 'No se pudo eliminar el departamento. Verifica restricciones.');
            }
        }
    };

    return (
        <div style={{ fontFamily: 'sans-serif', marginTop: '10px' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '20px', color: '#111827' }}>Estructura Organizacional</h3>
            {/* 🔥 MODIFICADO: Se removió la etiqueta (RF-04) */}
            <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px 0' }}>Gestión avanzada de departamentos funcionales y puestos de trabajo con jerarquías de mando.</p>

            {/* Formulario de creación de Área en NARANJA */}
            <form onSubmit={handleCrearDepartamento} style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
                <input
                    type="text"
                    value={nuevoDept}
                    onChange={(e) => setNuevoDept(e.target.value)}
                    placeholder="Nombre del nuevo departamento (Ej: TI, Marketing)"
                    style={{ padding: '10px', width: '300px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '14px' }}
                    required
                />
                {/* 🔥 MODIFICADO: Color cambiado a naranja de la plataforma */}
                <button type="submit" style={{ padding: '10px 18px', backgroundColor: '#f97316', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                    + Crear Área
                </button>
            </form>

            {cargando ? (
                <p style={{ color: '#6b7280' }}>Construyendo jerarquías de la empresa...</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                    {departamentos.map((dept: any) => (
                        <div key={dept.departamento_id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>

                            {/* 🔥 MODIFICADO: Línea de acento cambiada al azul marino corporativo */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1A1C4b', paddingBottom: '8px' }}>
                                <strong style={{ fontSize: '15px', color: '#1f2937' }}>{dept.nombre} (ID: {dept.departamento_id})</strong>
                                <button
                                    onClick={() => handleEliminarDepartamento(dept.departamento_id, dept.nombre)}
                                    style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', padding: '5px 10px', fontWeight: 'bold' }}
                                >
                                    Eliminar
                                </button>
                            </div>

                            <div style={{ marginTop: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563', margin: 0 }}>Línea de Mando Interna:</p>

                                    {deptIdSeleccionadoForCargo !== dept.departamento_id && (
                                        /* 🔥 MODIFICADO: Enlace "+ Añadir Cargo" ahora es naranja */
                                        <button
                                            onClick={() => {
                                                setCargoParentId('');
                                                setDeptIdSeleccionadoForCargo(dept.departamento_id);
                                            }}
                                            style={{ backgroundColor: 'transparent', color: '#f97316', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', padding: 0 }}
                                        >
                                            + Añadir Cargo
                                        </button>
                                    )}
                                </div>

                                {deptIdSeleccionadoForCargo === dept.departamento_id && (
                                    <form onSubmit={(e) => handleCrearCargo(e, dept.departamento_id)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px', backgroundColor: '#f9fafb', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                                        <input
                                            type="text"
                                            placeholder="Nombre del puesto (Ej: Jefe de TI)"
                                            value={nuevoCargoNombre}
                                            onChange={(e) => setNuevoCargoNombre(e.target.value)}
                                            style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                            required
                                            autoFocus
                                        />

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4b5563' }}>Reporta Directamente A:</label>
                                            <select
                                                value={cargoParentId}
                                                onChange={(e) => setCargoParentId(e.target.value)}
                                                style={{ padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#fff' }}
                                            >
                                                <option value="">-- Ninguno (Puesto de Máxima Autoridad) --</option>
                                                {dept.cargos.map((c: any) => (
                                                    <option key={c.cargo_id} value={c.cargo_id}>
                                                        {c.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                                            <button type="button" onClick={() => setDeptIdSeleccionadoForCargo(null)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#9ca3af', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                                Cancelar
                                            </button>
                                            <button type="submit" style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                Guardar Puesto
                                            </button>
                                        </div>
                                    </form>
                                )}

                                <ul style={{ paddingLeft: '0', margin: 0, fontSize: '13px', color: '#374151', listStyleType: 'none' }}>
                                    {dept.cargos && dept.cargos.length > 0 ? (
                                        dept.cargos.map((cargo: any) => {
                                            const nombreJefe = obtenerNombreCargoPadre(dept.cargos, cargo.parent_id);

                                            return (
                                                <li key={cargo.cargo_id} style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <span style={{ fontWeight: 'bold', color: '#1f2937' }}>{cargo.nombre}</span>
                                                    </div>

                                                    {nombreJefe && (
                                                        <div style={{ marginTop: '2px' }}>
                                                            {/* Cambiado a un tono coral/naranja coherente */}
                                                            <span style={{ color: '#f97316', fontSize: '11px', fontWeight: '500' }}>
                                                                🗲 Reporta a: <strong style={{ color: '#b43403' }}>{nombreJefe}</strong>
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div style={{ paddingLeft: '5px', marginTop: '6px', fontSize: '12px', color: '#4b5563', borderTop: '1px dashed #e5e7eb', paddingTop: '4px' }}>
                                                        {cargo.colaboradoresAsignados && cargo.colaboradoresAsignados.length > 0 ? (
                                                            cargo.colaboradoresAsignados.map((colab: any) => (
                                                                /* Cambiado a la paleta navy de la app */
                                                                <div key={colab.empleado_id} style={{ fontStyle: 'italic', color: '#1A1C4b', fontWeight: '500' }}>
                                                                    • {colab.nombre || `Empleado ID ${colab.empleado_id}`}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span style={{ color: '#9ca3af', fontSize: '11px' }}>• (Puesto Vacante)</span>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })
                                    ) : (
                                        <li style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '12px' }}>Sin puestos registrados aún.</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}