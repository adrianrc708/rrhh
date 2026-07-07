import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { colors, radius } from '../theme';
import { Modal, Field, Select, Btn, Badge, Loading, Empty, useToast, inputStyle } from './ui';

interface Evaluacion {
    id: number;
    periodo: string;
    puntualidad: number;
    calidad_trabajo: number;
    trabajo_equipo: number;
    iniciativa: number;
    puntaje_promedio: number;
    comentarios: string | null;
}

interface Incidencia {
    id: number;
    tipo: string;
    fecha: string;
    motivo: string;
    dias_suspension: number | null;
}

const TIPO_INCIDENCIA_TONE: Record<string, any> = {
    Amonestacion_verbal: 'amber', Amonestacion_escrita: 'orange', Memorandum: 'blue', Suspension: 'red',
};

export default function ModalDesempeno({ empleado, onClose }: { empleado: any; onClose: () => void }) {
    const toast = useToast();
    const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
    const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
    const [cargando, setCargando] = useState(true);
    const [seccion, setSeccion] = useState<'evaluaciones' | 'kardex'>('evaluaciones');

    // Form evaluación
    const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
    const [puntualidad, setPuntualidad] = useState('4');
    const [calidad, setCalidad] = useState('4');
    const [equipo, setEquipo] = useState('4');
    const [iniciativa, setIniciativa] = useState('4');
    const [comentarios, setComentarios] = useState('');
    const [guardandoEval, setGuardandoEval] = useState(false);

    // Form incidencia
    const [tipoInc, setTipoInc] = useState('Amonestacion_verbal');
    const [fechaInc, setFechaInc] = useState(new Date().toISOString().slice(0, 10));
    const [motivoInc, setMotivoInc] = useState('');
    const [diasSuspension, setDiasSuspension] = useState('1');
    const [guardandoInc, setGuardandoInc] = useState(false);

    const cargar = async () => {
        try {
            setCargando(true);
            const [resEval, resInc] = await Promise.all([
                api.get(`/desempeno/evaluaciones/${empleado.empleado_id}`),
                api.get(`/desempeno/incidencias/${empleado.empleado_id}`),
            ]);
            setEvaluaciones(resEval.data);
            setIncidencias(resInc.data);
        } catch (err) {
            console.error('Error al cargar desempeño:', err);
        } finally { setCargando(false); }
    };

    useEffect(() => { cargar(); }, []);

    const registrarEvaluacion = async (e: React.FormEvent) => {
        e.preventDefault();
        setGuardandoEval(true);
        try {
            await api.post('/desempeno/evaluaciones', {
                empleado_id: empleado.empleado_id, periodo,
                puntualidad: Number(puntualidad), calidad_trabajo: Number(calidad),
                trabajo_equipo: Number(equipo), iniciativa: Number(iniciativa),
                comentarios: comentarios || null,
            });
            toast('success', 'Evaluación registrada correctamente.');
            setComentarios('');
            cargar();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo registrar la evaluación.');
        } finally { setGuardandoEval(false); }
    };

    const registrarIncidencia = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!motivoInc.trim()) { toast('warning', 'Describe el motivo de la incidencia.'); return; }
        setGuardandoInc(true);
        try {
            await api.post('/desempeno/incidencias', {
                empleado_id: empleado.empleado_id, tipo: tipoInc, fecha: fechaInc, motivo: motivoInc,
                dias_suspension: tipoInc === 'Suspension' ? Number(diasSuspension) : null,
            });
            toast('success', 'Incidencia registrada en el kardex.');
            setMotivoInc('');
            cargar();
        } catch (err: any) {
            toast('error', err?.response?.data?.detail || 'No se pudo registrar la incidencia.');
        } finally { setGuardandoInc(false); }
    };

    return (
        <Modal title={`Desempeño — ${empleado.nombre || 'colaborador'}`} onClose={onClose} width={620}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button onClick={() => setSeccion('evaluaciones')} style={{
                    flex: 1, padding: '9px', borderRadius: radius.sm, cursor: 'pointer', fontWeight: 600, fontSize: 13.5,
                    border: `1.5px solid ${seccion === 'evaluaciones' ? colors.orange : colors.border}`,
                    background: seccion === 'evaluaciones' ? colors.orangeSoft : '#fff',
                    color: seccion === 'evaluaciones' ? colors.orangeText : colors.textMuted,
                }}>Evaluaciones de desempeño</button>
                <button onClick={() => setSeccion('kardex')} style={{
                    flex: 1, padding: '9px', borderRadius: radius.sm, cursor: 'pointer', fontWeight: 600, fontSize: 13.5,
                    border: `1.5px solid ${seccion === 'kardex' ? colors.orange : colors.border}`,
                    background: seccion === 'kardex' ? colors.orangeSoft : '#fff',
                    color: seccion === 'kardex' ? colors.orangeText : colors.textMuted,
                }}>Kardex disciplinario</button>
            </div>

            {cargando ? <Loading /> : seccion === 'evaluaciones' ? (
                <div>
                    <form onSubmit={registrarEvaluacion} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, padding: 14, background: colors.bg, borderRadius: radius.md }}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 130px' }}>
                                <Field label="Periodo"><input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={inputStyle} /></Field>
                            </div>
                            <div style={{ flex: '1 1 100px' }}>
                                <Field label="Puntualidad (1-5)"><input type="number" min="1" max="5" value={puntualidad} onChange={(e) => setPuntualidad(e.target.value)} style={inputStyle} /></Field>
                            </div>
                            <div style={{ flex: '1 1 100px' }}>
                                <Field label="Calidad (1-5)"><input type="number" min="1" max="5" value={calidad} onChange={(e) => setCalidad(e.target.value)} style={inputStyle} /></Field>
                            </div>
                            <div style={{ flex: '1 1 100px' }}>
                                <Field label="Trabajo en equipo (1-5)"><input type="number" min="1" max="5" value={equipo} onChange={(e) => setEquipo(e.target.value)} style={inputStyle} /></Field>
                            </div>
                            <div style={{ flex: '1 1 100px' }}>
                                <Field label="Iniciativa (1-5)"><input type="number" min="1" max="5" value={iniciativa} onChange={(e) => setIniciativa(e.target.value)} style={inputStyle} /></Field>
                            </div>
                        </div>
                        <Field label="Comentarios (opcional)">
                            <textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} />
                        </Field>
                        <div><Btn type="submit" icon="plus" disabled={guardandoEval}>{guardandoEval ? 'Guardando…' : 'Registrar evaluación'}</Btn></div>
                    </form>

                    {evaluaciones.length === 0 ? <Empty text="Aún no hay evaluaciones registradas." /> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {evaluaciones.map((e) => (
                                <div key={e.id} style={{ padding: 12, border: `1px solid ${colors.border}`, borderRadius: radius.md }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong style={{ fontSize: 13.5, color: colors.textStrong }}>{e.periodo}</strong>
                                        <Badge tone={e.puntaje_promedio >= 4 ? 'green' : e.puntaje_promedio >= 3 ? 'amber' : 'red'}>
                                            {e.puntaje_promedio.toFixed(2)} / 5.00
                                        </Badge>
                                    </div>
                                    <p style={{ margin: '6px 0 0', fontSize: 12, color: colors.textMuted }}>
                                        Puntualidad {e.puntualidad} · Calidad {e.calidad_trabajo} · Equipo {e.trabajo_equipo} · Iniciativa {e.iniciativa}
                                    </p>
                                    {e.comentarios && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: colors.textBody }}>{e.comentarios}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <form onSubmit={registrarIncidencia} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, padding: 14, background: colors.bg, borderRadius: radius.md }}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 200px' }}>
                                <Field label="Tipo">
                                    <Select value={tipoInc} onChange={setTipoInc}>
                                        <option value="Amonestacion_verbal">Amonestación verbal</option>
                                        <option value="Amonestacion_escrita">Amonestación escrita</option>
                                        <option value="Memorandum">Memorándum</option>
                                        <option value="Suspension">Suspensión</option>
                                    </Select>
                                </Field>
                            </div>
                            <div style={{ flex: '1 1 150px' }}>
                                <Field label="Fecha"><input type="date" value={fechaInc} onChange={(e) => setFechaInc(e.target.value)} style={inputStyle} /></Field>
                            </div>
                            {tipoInc === 'Suspension' && (
                                <div style={{ flex: '1 1 100px' }}>
                                    <Field label="Días"><input type="number" min="1" value={diasSuspension} onChange={(e) => setDiasSuspension(e.target.value)} style={inputStyle} /></Field>
                                </div>
                            )}
                        </div>
                        <Field label="Motivo">
                            <textarea value={motivoInc} onChange={(e) => setMotivoInc(e.target.value)} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} required />
                        </Field>
                        <div><Btn type="submit" variant="danger" icon="alert" disabled={guardandoInc}>{guardandoInc ? 'Guardando…' : 'Registrar incidencia'}</Btn></div>
                    </form>

                    {incidencias.length === 0 ? <Empty text="Sin incidencias disciplinarias registradas." /> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {incidencias.map((i) => (
                                <div key={i.id} style={{ padding: 12, border: `1px solid ${colors.border}`, borderRadius: radius.md }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Badge tone={TIPO_INCIDENCIA_TONE[i.tipo] || 'gray'}>{i.tipo.replace(/_/g, ' ')}</Badge>
                                        <span style={{ fontSize: 12, color: colors.textMuted }}>{i.fecha}</span>
                                    </div>
                                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: colors.textBody }}>{i.motivo}</p>
                                    {i.dias_suspension && <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.redText }}>{i.dias_suspension} día(s) de suspensión</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
