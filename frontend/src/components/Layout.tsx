import React from 'react';
import { colors, radius, font } from '../theme';
import Icon from './Icons';
import { OmniaLogo } from './OmniaLogo';

export type SectionKey = 'dashboard' | 'personal' | 'asistencia' | 'nomina' | 'auditoria' | 'admin';

const NAV: { key: SectionKey; label: string; sub: string; icon: string; adminOnly?: boolean }[] = [
    { key: 'dashboard', label: 'Dashboard', sub: 'Analítica predictiva de IA', icon: 'dashboard' },
    { key: 'personal', label: 'Personal', sub: 'Directorio y estructura', icon: 'users' },
    { key: 'asistencia', label: 'Asistencia', sub: 'Gestión de registros biométricos', icon: 'clock' },
    { key: 'nomina', label: 'Nómina', sub: 'Cálculos automatizados', icon: 'dollar' },
    { key: 'auditoria', label: 'Auditoría', sub: 'Reportes de cumplimiento', icon: 'shield' },
    { key: 'admin', label: 'Super Admin', sub: 'Gestión global', icon: 'shield', adminOnly: true },
];

function NavItem({ item, active, onClick }: { item: typeof NAV[number]; active: boolean; onClick: () => void }) {
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

export default function Layout({
    active, onNavigate, user, onLogout, children,
}: {
    active: SectionKey;
    onNavigate: (s: SectionKey) => void;
    user: { nombre: string; rol: string };
    onLogout: () => void;
    children: React.ReactNode;
}) {
    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: colors.bg, fontFamily: font, overflow: 'hidden' }}>
            {/* SIDEBAR */}
            <aside style={{
                width: 270, flexShrink: 0, background: colors.navy900, color: '#fff',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
                <div>
                    <div style={{ padding: '16px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <OmniaLogo variant="compact" width={150} />
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Gestión centralizada SaaS</p>
                    </div>
                    <nav style={{ padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {NAV.filter(i => !i.adminOnly || user.rol === 'SuperAdmin').map((item) => (
                            <NavItem key={item.key} item={item as any} active={active === item.key} onClick={() => onNavigate(item.key)} />
                        ))}
                    </nav>
                </div>

                <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
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
        </div>
    );
}
