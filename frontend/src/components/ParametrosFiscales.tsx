import React, { useEffect, useState } from 'react';
import { colors, font } from '../theme';
import api from '../services/api';
import { Card, Btn, Badge, Modal, useToast, inputStyle, tableStyles, Loading, Empty } from './ui';

// ============================================================================
// Fase 1 — Panel SuperAdmin: parámetros fiscales/macro versionados.
//
// Variables globales (RMV, UIT, tasas ONP/AFP/EsSalud) que afectan el cálculo de
// nómina de TODAS las empresas. Cada cambio crea una nueva vigencia y cierra la
// anterior, conservando el historial. El motor de cálculo lee el valor vigente.
// ============================================================================

interface Vigente {
    clave: string;
    valor: string;
    descripcion: string | null;
}

interface Historial {
    id: number;
    clave: string;
    valor: string;
    descripcion: string | null;
    vigencia_desde: string;
    vigencia_hasta: string | null;
    activo: boolean;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function ParametrosFiscales() {
    const toast = useToast();
    const [vigentes, setVigentes] = useState<Vigente[]>([]);
    const [historial, setHistorial] = useState<Historial[]>([]);
    const [loading, setLoading] = useState(true);
    const [claveHistorial, setClaveHistorial] = useState<string | null>(null);
    const [modal, setModal] = useState<{ clave: string; descripcion: string | null } | null>(null);
    const [form, setForm] = useState<{ valor: string; vigencia_desde: string }>({ valor: '', vigencia_desde: hoyISO() });

    const cargar = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/parametros/vigentes');
            setVigentes(res.data);
        } catch (e: any) {
            toast('error', 'Error al cargar parámetros: ' + (e.response?.data?.detail || e.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    const abrirHistorial = async (clave: string) => {
        try {
            const res = await api.get('/admin/parametros', { params: { clave } });
            setHistorial(res.data);
            setClaveHistorial(clave);
        } catch (e: any) {
            toast('error', 'Error: ' + (e.response?.data?.detail || e.message));
        }
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modal) return;
        if (form.valor === '' || isNaN(Number(form.valor))) {
            toast('error', 'Ingresa un valor numérico válido.');
            return;
        }
        try {
            await api.post('/admin/parametros', {
                clave: modal.clave,
                valor: Number(form.valor),
                vigencia_desde: form.vigencia_desde,
                descripcion: modal.descripcion,
            });
            toast('success', `Nueva vigencia de ${modal.clave} registrada.`);
            setModal(null);
            cargar();
            if (claveHistorial === modal.clave) abrirHistorial(modal.clave);
        } catch (e: any) {
            toast('error', 'Error: ' + (e.response?.data?.detail || e.message));
        }
    };

    if (loading) return <Loading text="Cargando parámetros fiscales…" />;

    return (
        <div style={{ fontFamily: font }}>
            <Card style={{ marginBottom: 24 }}>
                <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>
                    Estos valores son <b>globales</b> y afectan el cálculo de nómina de todas las empresas.
                    Cada actualización crea una nueva vigencia y conserva el historial.
                </p>
            </Card>

            <Card style={{ marginBottom: 28 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Valores vigentes</h3>
                <table style={tableStyles.table as React.CSSProperties}>
                    <thead>
                        <tr>
                            <th style={tableStyles.th as React.CSSProperties}>Clave</th>
                            <th style={tableStyles.th as React.CSSProperties}>Descripción</th>
                            <th style={tableStyles.th as React.CSSProperties}>Valor vigente</th>
                            <th style={tableStyles.th as React.CSSProperties}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {vigentes.map((v) => (
                            <tr key={v.clave}>
                                <td style={tableStyles.td as React.CSSProperties}><Badge tone="indigo">{v.clave}</Badge></td>
                                <td style={tableStyles.td as React.CSSProperties}>{v.descripcion || '—'}</td>
                                <td style={{ ...(tableStyles.td as React.CSSProperties), fontWeight: 700, color: colors.textStrong }}>
                                    {Number(v.valor).toLocaleString('es-PE', { maximumFractionDigits: 6 })}
                                </td>
                                <td style={tableStyles.td as React.CSSProperties}>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        <Btn size="sm" variant="outline" icon="clock" onClick={() => abrirHistorial(v.clave)}>Historial</Btn>
                                        <Btn size="sm" variant="indigo" icon="edit" onClick={() => { setModal({ clave: v.clave, descripcion: v.descripcion }); setForm({ valor: String(v.valor), vigencia_desde: hoyISO() }); }}>Nueva vigencia</Btn>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            {/* Historial de una clave */}
            {claveHistorial && (
                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.textStrong }}>
                            Historial de vigencias · {claveHistorial}
                        </h3>
                        <Btn size="sm" variant="ghost" icon="x" onClick={() => setClaveHistorial(null)}>Cerrar</Btn>
                    </div>
                    {historial.length === 0 ? (
                        <Empty text="Sin registros históricos (se está usando el valor por defecto)." />
                    ) : (
                        <table style={tableStyles.table as React.CSSProperties}>
                            <thead>
                                <tr>
                                    <th style={tableStyles.th as React.CSSProperties}>Valor</th>
                                    <th style={tableStyles.th as React.CSSProperties}>Desde</th>
                                    <th style={tableStyles.th as React.CSSProperties}>Hasta</th>
                                    <th style={tableStyles.th as React.CSSProperties}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historial.map((h) => (
                                    <tr key={h.id}>
                                        <td style={tableStyles.td as React.CSSProperties}>{Number(h.valor).toLocaleString('es-PE', { maximumFractionDigits: 6 })}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>{h.vigencia_desde}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>{h.vigencia_hasta || 'Vigente'}</td>
                                        <td style={tableStyles.td as React.CSSProperties}>
                                            <Badge tone={h.vigencia_hasta === null && h.activo ? 'green' : 'gray'}>
                                                {h.vigencia_hasta === null && h.activo ? 'Vigente' : 'Cerrada'}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            )}

            {/* Modal nueva vigencia */}
            {modal && (
                <Modal title={`Nueva vigencia · ${modal.clave}`} onClose={() => setModal(null)}>
                    <form onSubmit={guardar} style={{ display: 'grid', gap: 16 }}>
                        <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>{modal.descripcion}</p>
                        <div>
                            <label style={{ fontSize: 13 }}>Nuevo valor</label>
                            <input required type="number" step="any" style={inputStyle} value={form.valor}
                                onChange={(e) => setForm({ ...form, valor: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ fontSize: 13 }}>Vigente desde</label>
                            <input required type="date" style={inputStyle} value={form.vigencia_desde}
                                onChange={(e) => setForm({ ...form, vigencia_desde: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 6, justifyContent: 'flex-end' }}>
                            <Btn type="button" variant="outline" onClick={() => setModal(null)}>Cancelar</Btn>
                            <Btn type="submit" variant="indigo">Guardar vigencia</Btn>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
