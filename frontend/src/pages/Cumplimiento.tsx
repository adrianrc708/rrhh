import React, { useEffect, useState } from 'react';
import { colors, font } from '../theme';
import api from '../services/api';
import {
    Card, PageHeader, Badge, Loading, Empty, tableStyles, Btn, Field, Select,
    inputStyle, useToast, Tabs,
} from '../components/ui';

// ============================================================================
// Fase 6 — Cumplimiento y salidas legales (RRHH / Admin).
//   · Exportadores SUNAT/AFP/banca (PLAME, T-Registro, AFPnet, dispersión).
//   · Legajo digital por trabajador.
//   · Certificados de la empresa y firma de boletas en lote.
// ============================================================================

interface Nomina { id: number; periodo: string; estado: string; }
interface Empleado { empleado_id: number; nombre?: string; }
interface Doc { documento_id: number; categoria: string; nombre: string; fecha_creacion?: string; }
interface Cert { certificado_id: number; nombre: string; titular?: string; huella?: string; activo: boolean; }

function descargar(filename: string, contenido: string, mimetype: string) {
    const blob = new Blob(['﻿' + contenido], { type: `${mimetype};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default function Cumplimiento() {
    const toast = useToast();
    const [tab, setTab] = useState('Exportadores');
    const [loading, setLoading] = useState(true);
    const [nominas, setNominas] = useState<Nomina[]>([]);
    const [empleados, setEmpleados] = useState<Empleado[]>([]);

    // Exportadores
    const [nominaSel, setNominaSel] = useState('');
    const [banco, setBanco] = useState('BCP');

    // Legajo
    const [legEmp, setLegEmp] = useState('');
    const [docs, setDocs] = useState<Doc[]>([]);
    const [categoria, setCategoria] = useState('Contrato');
    const [archivoNombre, setArchivoNombre] = useState('');
    const [archivoDatos, setArchivoDatos] = useState('');

    // Certificados
    const [certs, setCerts] = useState<Cert[]>([]);
    const [certNombre, setCertNombre] = useState('');
    const [certTitular, setCertTitular] = useState('');
    const [certHuella, setCertHuella] = useState('');

    const cargar = async () => {
        try {
            const [n, e, c] = await Promise.all([
                api.get('/nominas/'),
                api.get('/empleados/'),
                api.get('/cumplimiento/certificados').catch(() => ({ data: [] })),
            ]);
            setNominas(Array.isArray(n.data) ? n.data : []);
            setEmpleados(Array.isArray(e.data) ? e.data : []);
            setCerts(Array.isArray(c.data) ? c.data : []);
        } catch { toast('error', 'No se pudo cargar la información.'); }
        finally { setLoading(false); }
    };
    useEffect(() => { cargar(); }, []);

    const exportar = async (endpoint: string, params?: any) => {
        if (!nominaSel) { toast('error', 'Selecciona una nómina.'); return; }
        try {
            const res = await api.get(`/cumplimiento/nominas/${nominaSel}/${endpoint}`, { params });
            descargar(res.data.filename, res.data.contenido, res.data.mimetype || 'text/plain');
            toast('success', `${res.data.filename} generado (${res.data.filas} líneas).`);
        } catch (e: any) {
            toast('error', e?.response?.data?.detail || 'No se pudo generar el archivo.');
        }
    };

    const verLegajo = async (empId: string) => {
        setLegEmp(empId);
        if (!empId) { setDocs([]); return; }
        try {
            const res = await api.get(`/cumplimiento/legajo/${empId}`);
            setDocs(Array.isArray(res.data) ? res.data : []);
        } catch { setDocs([]); }
    };

    const onFile = (f: File | null) => {
        if (!f) { setArchivoNombre(''); setArchivoDatos(''); return; }
        if (f.size > 4 * 1024 * 1024) { toast('error', 'Máx 4 MB.'); return; }
        const r = new FileReader();
        r.onload = () => { setArchivoDatos(String(r.result)); setArchivoNombre(f.name); };
        r.readAsDataURL(f);
    };

    const subirDoc = async () => {
        if (!legEmp || !archivoDatos) { toast('error', 'Selecciona empleado y archivo.'); return; }
        try {
            await api.post('/cumplimiento/legajo', {
                empleado_id: Number(legEmp), categoria, nombre: archivoNombre, datos: archivoDatos,
            });
            toast('success', 'Documento archivado.');
            setArchivoNombre(''); setArchivoDatos('');
            verLegajo(legEmp);
        } catch (e: any) { toast('error', e?.response?.data?.detail || 'No se pudo subir.'); }
    };

    const descargarDoc = async (id: number) => {
        try {
            const res = await api.get(`/cumplimiento/legajo/documento/${id}/descargar`);
            const a = document.createElement('a');
            a.href = res.data.datos; a.download = res.data.nombre;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch { toast('error', 'No se pudo descargar.'); }
    };

    const eliminarDoc = async (id: number) => {
        try { await api.delete(`/cumplimiento/legajo/${id}`); verLegajo(legEmp); }
        catch { toast('error', 'No se pudo eliminar.'); }
    };

    const crearCert = async () => {
        if (!certNombre.trim()) { toast('error', 'Indica un nombre.'); return; }
        try {
            await api.post('/cumplimiento/certificados', { nombre: certNombre, titular: certTitular, huella: certHuella });
            toast('success', 'Certificado registrado.');
            setCertNombre(''); setCertTitular(''); setCertHuella('');
            cargar();
        } catch (e: any) { toast('error', e?.response?.data?.detail || 'No se pudo registrar (¿eres Admin?).'); }
    };

    const firmarLote = async () => {
        if (!nominaSel) { toast('error', 'Selecciona una nómina.'); return; }
        try {
            const res = await api.post(`/cumplimiento/nominas/${nominaSel}/firmar-lote`);
            toast('success', `${res.data.boletas_firmadas} boleta(s) firmada(s) por la empresa.`);
        } catch (e: any) { toast('error', e?.response?.data?.detail || 'No se pudo firmar (¿eres Admin?).'); }
    };

    if (loading) return <Loading text="Cargando cumplimiento…" />;

    return (
        <div style={{ fontFamily: font }}>
            <PageHeader title="Cumplimiento y salidas legales" subtitle="Genera las declaraciones ante SUNAT/AFP, dispersa haberes y gestiona el legajo digital." />
            <Tabs tabs={['Exportadores', 'Legajo digital', 'Certificados y firmas']} active={tab} onChange={setTab} />

            {tab === 'Exportadores' && (
                <Card>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
                        <Field label="Nómina / periodo">
                            <Select value={nominaSel} onChange={setNominaSel} style={{ width: 260 }}>
                                <option value="">Selecciona…</option>
                                {nominas.map((n) => <option key={n.id} value={n.id}>{n.periodo} — {n.estado}</option>)}
                            </Select>
                        </Field>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                        <ExportCard titulo="PLAME (SUNAT)" desc="Planilla Mensual de Pagos." onClick={() => exportar('plame')} />
                        <ExportCard titulo="T-Registro (SUNAT)" desc="Registro de trabajadores." onClick={() => exportar('tregistro')} />
                        <ExportCard titulo="AFPnet" desc="Aportes al SPP (CSV)." onClick={() => exportar('afpnet')} />
                        <div style={{ padding: 18, border: `1px solid ${colors.border}`, borderRadius: 12 }}>
                            <p style={{ margin: '0 0 4px', fontWeight: 700, color: colors.textStrong }}>Dispersión bancaria</p>
                            <p style={{ margin: '0 0 12px', fontSize: 13, color: colors.textMuted }}>Abono de haberes (requiere nómina Pagada).</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Select value={banco} onChange={setBanco} style={{ width: 130 }}>
                                    {['BCP', 'BBVA', 'Interbank', 'Scotiabank'].map((b) => <option key={b} value={b}>{b}</option>)}
                                </Select>
                                <Btn size="sm" icon="download" onClick={() => exportar('dispersion', { banco })}>Generar</Btn>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {tab === 'Legajo digital' && (
                <Card>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
                        <Field label="Empleado">
                            <Select value={legEmp} onChange={verLegajo} style={{ width: 240 }}>
                                <option value="">Selecciona…</option>
                                {empleados.map((e) => <option key={e.empleado_id} value={e.empleado_id}>{e.nombre || `#${e.empleado_id}`}</option>)}
                            </Select>
                        </Field>
                        <Field label="Categoría">
                            <Select value={categoria} onChange={setCategoria} style={{ width: 180 }}>
                                {['Contrato', 'DNI', 'Certificado_medico', 'Titulo', 'Otro'].map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                            </Select>
                        </Field>
                        <Field label="Archivo (máx 4 MB)">
                            <input type="file" onChange={(e) => onFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
                        </Field>
                        <Btn icon="plus" disabled={!legEmp || !archivoDatos} onClick={subirDoc}>Archivar</Btn>
                    </div>
                    {!legEmp ? <Empty text="Selecciona un empleado para ver su legajo." />
                        : docs.length === 0 ? <Empty text="Sin documentos en el legajo." />
                            : (
                                <table style={tableStyles.table as React.CSSProperties}>
                                    <thead><tr>
                                        <th style={tableStyles.th as React.CSSProperties}>Documento</th>
                                        <th style={tableStyles.th as React.CSSProperties}>Categoría</th>
                                        <th style={tableStyles.th as React.CSSProperties}>Fecha</th>
                                        <th style={tableStyles.th as React.CSSProperties}></th>
                                    </tr></thead>
                                    <tbody>
                                        {docs.map((d) => (
                                            <tr key={d.documento_id}>
                                                <td style={tableStyles.td as React.CSSProperties}>{d.nombre}</td>
                                                <td style={tableStyles.td as React.CSSProperties}><Badge tone="blue">{d.categoria.replace('_', ' ')}</Badge></td>
                                                <td style={tableStyles.td as React.CSSProperties}>{d.fecha_creacion ? new Date(d.fecha_creacion).toLocaleDateString('es-PE') : '—'}</td>
                                                <td style={tableStyles.td as React.CSSProperties}>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <Btn size="sm" variant="outline" icon="download" onClick={() => descargarDoc(d.documento_id)}>Ver</Btn>
                                                        <Btn size="sm" variant="danger" icon="trash" onClick={() => eliminarDoc(d.documento_id)}>Eliminar</Btn>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                </Card>
            )}

            {tab === 'Certificados y firmas' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: 20, alignItems: 'start' }}>
                    <Card>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Certificado digital</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Field label="Nombre"><input style={inputStyle} value={certNombre} onChange={(e) => setCertNombre(e.target.value)} placeholder="Firma RRHH 2026" /></Field>
                            <Field label="Titular"><input style={inputStyle} value={certTitular} onChange={(e) => setCertTitular(e.target.value)} placeholder="Razón social / representante" /></Field>
                            <Field label="Huella / serial"><input style={inputStyle} value={certHuella} onChange={(e) => setCertHuella(e.target.value)} /></Field>
                            <Btn icon="plus" onClick={crearCert}>Registrar certificado</Btn>
                        </div>
                        <div style={{ marginTop: 20 }}>
                            {certs.length === 0 ? <Empty text="Sin certificados." /> : certs.map((c) => (
                                <div key={c.certificado_id} style={{ padding: 12, border: `1px solid ${colors.borderSoft}`, borderRadius: 10, marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <strong style={{ color: colors.textStrong, fontSize: 14 }}>{c.nombre}</strong>
                                        <Badge tone={c.activo ? 'green' : 'gray'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge>
                                    </div>
                                    {c.titular && <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.textMuted }}>{c.titular}</p>}
                                </div>
                            ))}
                        </div>
                    </Card>
                    <Card>
                        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>Firma de boletas en lote</h3>
                        <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted }}>
                            Sella con la firma electrónica de la empresa todas las boletas de una nómina antes de distribuirlas.
                        </p>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <Field label="Nómina">
                                <Select value={nominaSel} onChange={setNominaSel} style={{ width: 240 }}>
                                    <option value="">Selecciona…</option>
                                    {nominas.map((n) => <option key={n.id} value={n.id}>{n.periodo} — {n.estado}</option>)}
                                </Select>
                            </Field>
                            <Btn icon="check" onClick={firmarLote}>Firmar boletas</Btn>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

function ExportCard({ titulo, desc, onClick }: { titulo: string; desc: string; onClick: () => void }) {
    return (
        <div style={{ padding: 18, border: `1px solid ${colors.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ margin: 0, fontWeight: 700, color: colors.textStrong }}>{titulo}</p>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: colors.textMuted, flex: 1 }}>{desc}</p>
            <Btn size="sm" icon="download" variant="outline" onClick={onClick}>Generar archivo</Btn>
        </div>
    );
}
