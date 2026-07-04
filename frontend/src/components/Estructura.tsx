import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors, radius } from '../theme';
import { Card, Field, Select, Btn, Badge, Loading, useToast, inputStyle } from './ui';

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
        <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: colors.textStrong }}>Estructura Organizacional</h3>
            <p style={{ color: colors.textMuted, fontSize: 13, margin: '0 0 20px' }}>Gestión avanzada de departamentos funcionales y puestos de trabajo con jerarquías de mando.</p>

            {/* Formulario de creación de Área */}
            <form onSubmit={handleCrearDepartamento} style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
                <input
                    type="text"
                    value={nuevoDept}
                    onChange={(e) => setNuevoDept(e.target.value)}
                    placeholder="Nombre del nuevo departamento (Ej: TI, Marketing)"
                    style={{ ...inputStyle, width: 320 }}
                    required
                />
                <Btn type="submit" icon="plus">Crear Área</Btn>
            </form>

            {cargando ? (
                <Loading text="Construyendo jerarquías de la empresa…" />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
                    {departamentos.map((dept: any) => (
                        <Card key={dept.departamento_id} pad={18}>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${colors.navy900}`, paddingBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <strong style={{ fontSize: 15, color: colors.textStrong }}>{dept.nombre}</strong>
                                    <Badge tone="gray">ID {dept.departamento_id}</Badge>
                                </div>
                                <Btn size="sm" variant="danger" icon="trash" onClick={() => handleEliminarDepartamento(dept.departamento_id, dept.nombre)}>
                                    Eliminar
                                </Btn>
                            </div>

                            <div style={{ marginTop: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <p style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Línea de Mando Interna</p>

                                    {deptIdSeleccionadoForCargo !== dept.departamento_id && (
                                        <button
                                            onClick={() => {
                                                setCargoParentId('');
                                                setDeptIdSeleccionadoForCargo(dept.departamento_id);
                                            }}
                                            style={{ background: 'transparent', color: colors.orange, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, padding: 0 }}
                                        >
                                            + Añadir Cargo
                                        </button>
                                    )}
                                </div>

                                {deptIdSeleccionadoForCargo === dept.departamento_id && (
                                    <form onSubmit={(e) => handleCrearCargo(e, dept.departamento_id)} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, backgroundColor: colors.bg, padding: 12, borderRadius: radius.md, border: `1px solid ${colors.border}` }}>
                                        <input
                                            type="text"
                                            placeholder="Nombre del puesto (Ej: Jefe de TI)"
                                            value={nuevoCargoNombre}
                                            onChange={(e) => setNuevoCargoNombre(e.target.value)}
                                            style={inputStyle}
                                            required
                                            autoFocus
                                        />

                                        <Field label="Reporta directamente a">
                                            <Select value={cargoParentId} onChange={setCargoParentId}>
                                                <option value="">-- Ninguno (Puesto de Máxima Autoridad) --</option>
                                                {dept.cargos.map((c: any) => (
                                                    <option key={c.cargo_id} value={c.cargo_id}>
                                                        {c.nombre}
                                                    </option>
                                                ))}
                                            </Select>
                                        </Field>

                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <Btn size="sm" variant="outline" type="button" onClick={() => setDeptIdSeleccionadoForCargo(null)}>
                                                Cancelar
                                            </Btn>
                                            <Btn size="sm" variant="green" type="submit">
                                                Guardar Puesto
                                            </Btn>
                                        </div>
                                    </form>
                                )}

                                {dept.cargos && dept.cargos.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {dept.cargos.map((cargo: any) => {
                                            const nombreJefe = obtenerNombreCargoPadre(dept.cargos, cargo.parent_id);

                                            return (
                                                <div key={cargo.cargo_id} style={{ padding: 12, backgroundColor: colors.bg, borderRadius: radius.md, border: `1px solid ${colors.borderSoft}` }}>
                                                    <span style={{ fontWeight: 700, color: colors.textStrong, fontSize: 13.5 }}>{cargo.nombre}</span>

                                                    {nombreJefe && (
                                                        <div style={{ marginTop: 3 }}>
                                                            <span style={{ color: colors.orangeText, fontSize: 11.5, fontWeight: 600 }}>
                                                                › Reporta a <strong>{nombreJefe}</strong>
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div style={{ marginTop: 8, paddingTop: 6, fontSize: 12, color: colors.textMuted, borderTop: `1px dashed ${colors.border}` }}>
                                                        {cargo.colaboradoresAsignados && cargo.colaboradoresAsignados.length > 0 ? (
                                                            cargo.colaboradoresAsignados.map((colab: any) => (
                                                                <div key={colab.empleado_id} style={{ fontStyle: 'italic', color: colors.navy900, fontWeight: 500 }}>
                                                                    • {colab.nombre || `Empleado ID ${colab.empleado_id}`}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <Badge tone="gray">Puesto vacante</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p style={{ color: colors.textFaint, fontStyle: 'italic', fontSize: 12.5, margin: 0 }}>Sin puestos registrados aún.</p>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
