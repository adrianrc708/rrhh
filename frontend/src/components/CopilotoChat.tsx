import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { colors, radius } from '../theme';
import { Btn, Loading, inputStyle } from './ui';

interface Mensaje { role: 'user' | 'assistant'; content: string; }

// Fase 4 — Chat del Copiloto de IA. El backend acota el contexto al alcance del rol.
export default function CopilotoChat({ rol }: { rol?: string }) {
    const [mensajes, setMensajes] = useState<Mensaje[]>([]);
    const [input, setInput] = useState('');
    const [pensando, setPensando] = useState(false);
    const finRef = useRef<HTMLDivElement>(null);

    useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes, pensando]);

    const enviar = async (texto: string) => {
        const nuevos: Mensaje[] = [...mensajes, { role: 'user', content: texto }];
        setMensajes(nuevos);
        setInput('');
        setPensando(true);
        try {
            const res = await api.post('/ia/copiloto', { messages: nuevos });
            setMensajes([...nuevos, { role: 'assistant', content: res.data.respuesta }]);
        } catch (err: any) {
            const d = err?.response?.data?.detail;
            setMensajes([...nuevos, { role: 'assistant', content: typeof d === 'string' ? d : 'No se pudo contactar con el copiloto.' }]);
        } finally { setPensando(false); }
    };

    const onSubmit = (e: React.FormEvent) => { e.preventDefault(); if (input.trim()) enviar(input.trim()); };

    const sugerencias = rol === 'Gerente'
        ? ['Resume el impacto de las horas extra de mi equipo este mes', '¿Quién tuvo más inasistencias en mi equipo?']
        : ['Compara el ausentismo entre áreas este mes', '¿Hay bloqueos normativos en la última nómina y por qué?'];

    const renderMd = (t: string) => {
        const html = t
            .replace(/^### (.*$)/gim, `<h4 style="margin:12px 0 6px;color:${colors.textStrong}">$1</h4>`)
            .replace(/^## (.*$)/gim, `<h3 style="margin:14px 0 8px;color:${colors.textStrong}">$1</h3>`)
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/^\s*[-*] (.*$)/gim, '<li style="margin-left:18px">$1</li>')
            .replace(/\n/gim, '<br/>');
        return <div style={{ lineHeight: 1.6, fontSize: 13.5 }} dangerouslySetInnerHTML={{ __html: html }} />;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 2px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {mensajes.length === 0 && (
                    <div style={{ padding: 16, background: colors.bg, borderRadius: radius.md, border: `1px solid ${colors.border}` }}>
                        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: colors.textBody }}>
                            Pregúntame sobre tu {rol === 'Gerente' ? 'equipo' : 'empresa'}. Solo veo datos dentro de tus permisos.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {sugerencias.map((s) => (
                                <button key={s} onClick={() => enviar(s)} style={{ textAlign: 'left', padding: '9px 12px', border: `1px solid ${colors.border}`, background: '#fff', borderRadius: radius.sm, cursor: 'pointer', fontSize: 13, color: colors.textBody }}>{s}</button>
                            ))}
                        </div>
                    </div>
                )}
                {mensajes.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '88%', padding: '10px 14px', borderRadius: radius.md, background: m.role === 'user' ? colors.indigo : colors.bg, color: m.role === 'user' ? '#fff' : colors.textBody, border: m.role === 'user' ? 'none' : `1px solid ${colors.border}` }}>
                            {m.role === 'user' ? <div style={{ fontSize: 13.5 }}>{m.content}</div> : renderMd(m.content)}
                        </div>
                    </div>
                ))}
                {pensando && <div style={{ alignSelf: 'flex-start' }}><Loading text="Pensando…" /></div>}
                <div ref={finRef} />
            </div>
            <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribe tu pregunta…" disabled={pensando} style={{ ...inputStyle, flex: 1 }} />
                <Btn type="submit" variant="indigo" disabled={pensando || !input.trim()}>Enviar</Btn>
            </form>
        </div>
    );
}
