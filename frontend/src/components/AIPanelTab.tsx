import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import { colors, radius } from '../theme';
import { Card, Btn, Loading, useToast, inputStyle } from './ui';
import Icon from './Icons';

interface Message {
    role: string;
    content: string;
}

interface AIPanelTabProps {
    empleadoId?: string;
    messages?: Message[];
    setMessages?: (msgs: Message[]) => void;
}

export default function AIPanelTab({ empleadoId, messages = [], setMessages }: AIPanelTabProps) {
    const toast = useToast();
    const [analizando, setAnalizando] = useState(false);
    const [input, setInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const updateMessages = (newMessages: Message[]) => {
        if (setMessages) setMessages(newMessages);
    };

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const enviarMensaje = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        const isInitial = messages.length === 0 && !input.trim();
        const userContent = input.trim() || 'Genera el análisis general de inasistencias.';
        
        if (!isInitial && !input.trim()) return;

        const newMessages = [...messages];
        if (!isInitial || input.trim()) {
            newMessages.push({ role: 'user', content: userContent });
        }
        
        updateMessages(newMessages);
        setInput('');
        setAnalizando(true);

        try {
            const res = await api.post('/asistencia/ai-insights', {
                messages: newMessages,
                empleado_id: empleadoId ? Number(empleadoId) : null
            });
            updateMessages([...newMessages, { role: 'assistant', content: res.data.analysis }]);
        } catch (err) {
            console.error(err);
            toast('error', 'Ocurrió un error al contactar con la IA.');
            updateMessages([...newMessages, { role: 'assistant', content: 'Ocurrió un error al generar la respuesta. Por favor intenta de nuevo.' }]);
        } finally {
            setAnalizando(false);
        }
    };

    const limpiarChat = () => {
        if (window.confirm('¿Seguro que deseas limpiar la conversación actual?')) {
            updateMessages([]);
        }
    };

    const renderMarkdown = (text: string) => {
        let html = text
            .replace(/^### (.*$)/gim, '<h3 style="margin-top:16px; margin-bottom:8px; color:' + colors.textStrong + '">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 style="margin-top:20px; margin-bottom:10px; color:' + colors.textStrong + '">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 style="margin-top:20px; margin-bottom:12px; color:' + colors.textStrong + '">$1</h1>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/^\s*\d+\. (.*$)/gim, '<li style="margin-left:20px; margin-bottom:6px;">$1</li>')
            .replace(/^\s*- (.*$)/gim, '<li style="margin-left:20px; margin-bottom:6px;">$1</li>')
            .replace(/\n$/gim, '<br />');
        return <div style={{ lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: html }} />;
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: radius.md, background: colors.indigo, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="trending" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.textStrong }}>Asistente IA</h3>
                            <p style={{ margin: '4px 0 0', fontSize: 14, color: colors.textMuted }}>Haz preguntas sobre el historial de asistencia o solicita análisis.</p>
                        </div>
                    </div>
                    {messages.length > 0 && (
                        <Btn variant="outline" size="sm" onClick={limpiarChat} icon="trash">Limpiar Chat</Btn>
                    )}
                </div>

                {messages.length === 0 ? (
                    <div style={{ padding: 20, background: colors.bg, borderRadius: radius.md, border: `1px solid ${colors.border}`, marginBottom: 20 }}>
                        <p style={{ margin: '0 0 16px', fontSize: 14, color: colors.textBody }}>
                            El asistente tiene acceso al historial de faltas de todos los colaboradores. Puedes hacerle preguntas específicas 
                            como "¿Quién es el empleado con más inasistencias injustificadas?" o generar un análisis general.
                        </p>
                        <Btn variant="indigo" onClick={() => enviarMensaje()} disabled={analizando} icon="check">
                            {analizando ? 'Generando análisis...' : 'Generar Análisis General Inicial'}
                        </Btn>
                    </div>
                ) : (
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: 10, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{ 
                                    maxWidth: '85%', 
                                    padding: '12px 18px', 
                                    borderRadius: radius.md, 
                                    background: m.role === 'user' ? colors.indigo : colors.bg, 
                                    color: m.role === 'user' ? '#fff' : colors.textBody,
                                    border: m.role === 'user' ? 'none' : `1px solid ${colors.border}`,
                                    boxShadow: m.role === 'user' ? '0 4px 12px rgba(99,102,241,0.2)' : 'none'
                                }}>
                                    {m.role === 'user' ? <div style={{ lineHeight: '1.6' }}>{m.content}</div> : renderMarkdown(m.content)}
                                </div>
                            </div>
                        ))}
                        {analizando && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <div style={{ padding: '12px 18px', borderRadius: radius.md, background: colors.bg, border: `1px solid ${colors.border}` }}>
                                    <Loading text="Escribiendo..." />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                )}

                {messages.length > 0 && (
                    <form onSubmit={enviarMensaje} style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ej. ¿Qué impacto han tenido las inasistencias este mes?"
                            style={{ ...inputStyle, flex: 1 }}
                            disabled={analizando}
                        />
                        <Btn type="submit" variant="indigo" disabled={analizando || !input.trim()}>
                            Enviar
                        </Btn>
                    </form>
                )}
            </Card>
        </div>
    );
}
