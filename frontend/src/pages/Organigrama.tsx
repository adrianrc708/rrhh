import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { colors, radius, font } from '../theme';
import Icon from '../components/Icons';
import { Card, PageHeader, Loading, Empty, Badge, useToast } from '../components/ui';

// Fase 4 — Organigrama gráfico interactivo. El árbol se construye desde jefe_id
// (Fase 1). Arrastrar un nodo sobre otro reasigna su jefe (PATCH /empleados/{id}).
// El backend valida multi-tenant y evita ciclos.

interface Emp {
    empleado_id: number;
    nombre?: string;
    cargo_id?: number | null;
    jefe_id?: number | null;
    estado?: string;
}

const rolActual = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').rol; } catch { return undefined; } })();
const editable = ['Admin', 'RRHH', 'SuperAdmin'].includes(rolActual);

export default function Organigrama() {
    const toast = useToast();
    const [empleados, setEmpleados] = useState<Emp[]>([]);
    const [cargos, setCargos] = useState<Record<number, string>>({});
    const [cargando, setCargando] = useState(true);
    const [arrastrando, setArrastrando] = useState<number | null>(null);
    const [sobre, setSobre] = useState<number | 'root' | null>(null);

    const cargar = async () => {
        try {
            const [emp, car] = await Promise.all([api.get('/empleados/'), api.get('/empleados/cargos').catch(() => ({ data: [] }))]);
            setEmpleados(Array.isArray(emp.data) ? emp.data : []);
            const mapa: Record<number, string> = {};
            (car.data || []).forEach((c: any) => { mapa[c.cargo_id] = c.nombre; });
            setCargos(mapa);
        } catch (e) { console.error(e); } finally { setCargando(false); }
    };
    useEffect(() => { cargar(); }, []);

    // Construir árbol: raíces = sin jefe o cuyo jefe no está en el conjunto visible.
    const { raices, hijosDe } = useMemo(() => {
        const ids = new Set(empleados.map((e) => e.empleado_id));
        const hijos: Record<number, Emp[]> = {};
        const raices: Emp[] = [];
        for (const e of empleados) {
            if (e.jefe_id && ids.has(e.jefe_id)) {
                (hijos[e.jefe_id] = hijos[e.jefe_id] || []).push(e);
            } else {
                raices.push(e);
            }
        }
        return { raices, hijosDe: hijos };
    }, [empleados]);

    const reparentar = async (empleadoId: number, nuevoJefe: number | null) => {
        if (empleadoId === nuevoJefe) return;
        try {
            await api.patch(`/empleados/${empleadoId}`, { jefe_id: nuevoJefe });
            toast('success', nuevoJefe ? 'Dependencia actualizada.' : 'Nodo movido a la raíz.');
            cargar();
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo reasignar (¿ciclo jerárquico?).');
        }
    };

    const onDrop = (targetId: number | null) => {
        if (arrastrando == null) return;
        reparentar(arrastrando, targetId);
        setArrastrando(null); setSobre(null);
    };

    const Nodo = ({ emp, nivel }: { emp: Emp; nivel: number }) => {
        const hijos = hijosDe[emp.empleado_id] || [];
        const resaltado = sobre === emp.empleado_id;
        return (
            <div style={{ marginLeft: nivel === 0 ? 0 : 26, marginTop: 8 }}>
                <div
                    draggable={editable}
                    onDragStart={() => setArrastrando(emp.empleado_id)}
                    onDragOver={(e) => { if (editable) { e.preventDefault(); setSobre(emp.empleado_id); } }}
                    onDragLeave={() => setSobre((s) => (s === emp.empleado_id ? null : s))}
                    onDrop={(e) => { e.preventDefault(); onDrop(emp.empleado_id); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', maxWidth: 380,
                        background: resaltado ? colors.orangeSoft : '#fff',
                        border: `1.5px solid ${resaltado ? colors.orange : colors.border}`,
                        borderRadius: radius.md, cursor: editable ? 'grab' : 'default',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                >
                    <div style={{ width: 34, height: 34, borderRadius: radius.pill, background: colors.navy900, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {(emp.nombre || 'E').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.textStrong, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.nombre || `Empleado ${emp.empleado_id}`}</p>
                        <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>{emp.cargo_id && cargos[emp.cargo_id] ? cargos[emp.cargo_id] : '—'}</p>
                    </div>
                    {emp.estado && emp.estado !== 'Activo' && <Badge tone="gray">{emp.estado}</Badge>}
                    {editable && <Icon name="chevronRight" size={14} color={colors.textFaint} />}
                </div>
                {hijos.length > 0 && (
                    <div style={{ borderLeft: `2px dashed ${colors.border}`, marginLeft: 16, paddingLeft: 4 }}>
                        {hijos.map((h) => <Nodo key={h.empleado_id} emp={h} nivel={nivel + 1} />)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ fontFamily: font }}>
            <PageHeader
                title="Organigrama"
                subtitle={editable ? 'Arrastra un colaborador sobre otro para cambiar su línea de mando.' : 'Estructura jerárquica de tu equipo.'}
            />
            {cargando ? <Card><Loading /></Card> : empleados.length === 0 ? <Card><Empty text="No hay colaboradores para mostrar." /></Card> : (
                <Card>
                    {editable && (
                        <div
                            onDragOver={(e) => { e.preventDefault(); setSobre('root'); }}
                            onDragLeave={() => setSobre((s) => (s === 'root' ? null : s))}
                            onDrop={(e) => { e.preventDefault(); onDrop(null); }}
                            style={{
                                padding: '10px 14px', marginBottom: 12, borderRadius: radius.md, textAlign: 'center',
                                border: `1.5px dashed ${sobre === 'root' ? colors.orange : colors.border}`,
                                background: sobre === 'root' ? colors.orangeSoft : colors.bg,
                                fontSize: 12.5, color: colors.textMuted,
                            }}
                        >
                            Suelta aquí para dejar a un colaborador <strong>sin jefe (raíz)</strong>
                        </div>
                    )}
                    {raices.map((r) => <Nodo key={r.empleado_id} emp={r} nivel={0} />)}
                </Card>
            )}
        </div>
    );
}
