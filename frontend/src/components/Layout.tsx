import React, { useEffect, useState } from 'react';
import { colors, radius, font, shadow } from '../theme';
import Icon from './Icons';
import { OmniaLogo } from './OmniaLogo';
import api from '../services/api';
import { SectionKey, NavMeta, seccionesEfectivas } from '../auth/roles';
import CopilotoLauncher from './CopilotoLauncher';

// SectionKey se re-exporta para compatibilidad con importadores previos.
export type { SectionKey };

function NavItem({ item, active, onClick }: { item: NavMeta; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                position: 'relative', width: '100%', textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: radius.md, border: 'none', fontFamily: font,
                background: active ? 'linear-gradient(90deg, rgba(249,115,22,0.16), rgba(255,255,255,0.04))' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.72)',
                borderLeft: active ? `3px solid ${colors.orange}` : '3px solid transparent',
                transition: 'all .15s',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
        >
            <span style={{ color: active ? colors.orange : 'rgba(255,255,255,0.7)', display: 'flex' }}>
                <Icon name={item.icon} size={20} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: active ? colors.orange : '#fff' }}>{item.label}</span>
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>{item.sub}</span>
            </span>
        </button>
    );
}

function MonitorSelector() {
    const [empresas, setEmpresas] = useState<any[]>([]);
    const selected = localStorage.getItem('monitor_empresa_id') || '';

    useEffect(() => {
        api.get('/admin/empresas').then(res => setEmpresas(res.data)).catch(console.error);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value) {
            localStorage.setItem('monitor_empresa_id', e.target.value);
        } else {
            localStorage.removeItem('monitor_empresa_id');
        }
        window.location.reload();
    };

    const activa = empresas.find((e) => String(e.empresa_id) === selected);

    return (
        <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: radius.md, border: `1px solid ${selected ? colors.orange : 'rgba(255,255,255,0.1)'}` }}>
            <div style={{ fontSize: 11, color: colors.orange, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="building" size={14} /> Operar empresa cliente
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.35 }}>
                Elige una empresa para entrar a sus módulos como si fueras su administrador. Déjalo en “—” para quedarte en el panel global.
            </p>
            <select
                value={selected}
                onChange={handleChange}
                style={{
                    width: '100%', padding: '8px 10px', borderRadius: radius.sm,
                    background: colors.navy800, color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: 13, fontFamily: font, outline: 'none'
                }}
            >
                <option value="">— Solo panel global —</option>
                {empresas.map(e => (
                    <option key={e.empresa_id} value={e.empresa_id}>{e.razon_social}</option>
                ))}
            </select>
            {activa && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="eye" size={13} /> Viendo: {activa.razon_social}
                </div>
            )}
        </div>
    );
}

export default function Layout({
    active, onNavigate, user, onLogout, children,
}: {
    active: SectionKey;
    onNavigate: (s: SectionKey) => void;
    user: { nombre: string; rol: string; secciones?: string[] | null };
    onLogout: () => void;
    children: React.ReactNode;
}) {
    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: colors.bg, fontFamily: font, overflow: 'hidden' }}>
            {/* SIDEBAR */}
            <aside style={{
                width: 270, flexShrink: 0, background: colors.navy900, color: '#fff',
                display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
            }}>
                {/* Cabecera fija (logo + selector de empresa del SuperAdmin) */}
                <div style={{ flexShrink: 0, padding: '16px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <OmniaLogo variant="compact" width={150} />
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Gestión centralizada SaaS</p>
                    {user.rol === 'SuperAdmin' && <MonitorSelector />}
                </div>

                {/* Menú con scroll propio: nunca tapa el pie (perfil/logout) */}
                <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Fase 1: el menú se deriva del rol; Fase 7: respeta el override por usuario. */}
                    {seccionesEfectivas(user.rol, user.secciones).map((item) => (
                        <NavItem key={item.key} item={item} active={active === item.key} onClick={() => onNavigate(item.key)} />
                    ))}
                </nav>

                <div style={{ flexShrink: 0, padding: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: radius.md,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: radius.pill, flexShrink: 0,
                                background: colors.orange, color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: 15,
                            }}>
                                {(user.nombre || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.nombre}</p>
                                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{user.rol}</p>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            title="Cerrar sesión"
                            style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', display: 'flex', padding: 4 }}
                        >
                            <Icon name="logout" size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* CONTENIDO */}
            <main style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '36px 40px', maxWidth: 1400, margin: '0 auto' }}>
                    {children}
                </div>
            </main>

            {/* Fase 4: copiloto de IA flotante (solo roles de gestión) */}
            <CopilotoLauncher rol={user.rol} />
        </div>
    );
}
