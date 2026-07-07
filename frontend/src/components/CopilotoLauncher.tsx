import React, { useState } from 'react';
import { colors, radius, font } from '../theme';
import Icon from './Icons';
import CopilotoChat from './CopilotoChat';

// Fase 4 — Lanzador flotante del Copiloto de IA. Solo para roles de gestión.
const ROLES_CON_COPILOTO = ['Admin', 'RRHH', 'Gerente'];

export default function CopilotoLauncher({ rol }: { rol?: string }) {
    const [abierto, setAbierto] = useState(false);
    if (!rol || !ROLES_CON_COPILOTO.includes(rol)) return null;

    return (
        <>
            {/* Botón flotante */}
            <button
                onClick={() => setAbierto((v) => !v)}
                title="Copiloto de IA"
                style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
                    width: 58, height: 58, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: colors.indigo, color: '#fff', boxShadow: '0 10px 30px rgba(49,46,129,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
            >
                <Icon name={abierto ? 'x' : 'sparkles'} size={24} />
            </button>

            {/* Panel deslizable */}
            {abierto && (
                <div style={{
                    position: 'fixed', bottom: 96, right: 24, zIndex: 1200,
                    width: 400, maxWidth: 'calc(100vw - 48px)', height: 560, maxHeight: 'calc(100vh - 140px)',
                    background: '#fff', borderRadius: radius.lg, boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
                    display: 'flex', flexDirection: 'column', fontFamily: font, overflow: 'hidden',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: colors.navy900, color: '#fff' }}>
                        <div style={{ width: 34, height: 34, borderRadius: radius.md, background: colors.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="sparkles" size={18} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Copiloto de IA</p>
                            <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>Acotado a tus permisos</p>
                        </div>
                        <button onClick={() => setAbierto(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex' }}>
                            <Icon name="x" size={18} />
                        </button>
                    </div>
                    <div style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
                        <CopilotoChat rol={rol} />
                    </div>
                </div>
            )}
        </>
    );
}
