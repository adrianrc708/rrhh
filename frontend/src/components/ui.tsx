import React, { createContext, useCallback, useContext, useState } from 'react';
import { colors, radius, shadow, font } from '../theme';
import Icon from './Icons';

// ───────────────────────── Toast ─────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem { id: number; type: ToastType; message: string; }

const TOAST_STYLES: Record<ToastType, { border: string; icon: string; iconColor: string; bg: string }> = {
    success: { border: colors.green,   icon: 'check',   iconColor: colors.green,   bg: colors.greenSoft },
    error:   { border: colors.redText, icon: 'x',       iconColor: colors.redText, bg: colors.redSoft   },
    warning: { border: colors.orange,  icon: 'alert',   iconColor: colors.orange,  bg: colors.orangeSoft },
    info:    { border: colors.indigo,  icon: 'info',    iconColor: colors.indigo,  bg: colors.blueSoft  },
};

const ToastCtx = createContext<(type: ToastType, msg: string) => void>(() => {});

export function useToast() {
    return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const add = useCallback((type: ToastType, message: string) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
    }, []);

    const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    return (
        <ToastCtx.Provider value={add}>
            {children}
            <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, width: 340 }}>
                {toasts.map(t => {
                    const s = TOAST_STYLES[t.type];
                    return (
                        <div key={t.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 12,
                            background: '#fff', borderRadius: radius.md,
                            boxShadow: shadow.pop, padding: '14px 16px',
                            borderLeft: `4px solid ${s.border}`,
                            animation: 'toast-in .22s ease',
                            fontFamily: font,
                        }}>
                            <div style={{ width: 32, height: 32, borderRadius: radius.sm, background: s.bg, color: s.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon name={s.icon} size={16} />
                            </div>
                            <p style={{ margin: 0, fontSize: 13.5, color: colors.textBody, lineHeight: 1.45, flex: 1, paddingTop: 6 }}>{t.message}</p>
                            <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textFaint, padding: 4, flexShrink: 0 }}>
                                <Icon name="x" size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
            <style>{`@keyframes toast-in { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }`}</style>
        </ToastCtx.Provider>
    );
}

// ───────────────────────── Card ─────────────────────────
export function Card({ children, style, pad = 24 }: { children: React.ReactNode; style?: React.CSSProperties; pad?: number }) {
    return (
        <div style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            boxShadow: shadow.card,
            padding: pad,
            ...style,
        }}>
            {children}
        </div>
    );
}

// ───────────────────────── PageHeader ─────────────────────────
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
            <div>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: colors.textStrong, letterSpacing: '-0.02em' }}>{title}</h1>
                {subtitle && <p style={{ margin: '6px 0 0 0', fontSize: 15, color: colors.textMuted }}>{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

// ───────────────────────── Badge ─────────────────────────
type Tone = 'green' | 'blue' | 'orange' | 'amber' | 'purple' | 'red' | 'gray';
const TONES: Record<Tone, { bg: string; fg: string }> = {
    green: { bg: colors.greenSoft, fg: colors.greenText },
    blue: { bg: colors.blueSoft, fg: colors.blueText },
    orange: { bg: colors.orangeSoft, fg: colors.orangeText },
    amber: { bg: colors.amberSoft, fg: colors.amberText },
    purple: { bg: colors.purpleSoft, fg: colors.purpleText },
    red: { bg: colors.redSoft, fg: colors.redText },
    gray: { bg: '#F1F3F7', fg: colors.textMuted },
};

export function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: Tone }) {
    // Defensa: un tono desconocido cae a gris en vez de romper el render (pantalla blanca).
    const t = TONES[tone] || TONES.gray;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            backgroundColor: t.bg, color: t.fg,
            padding: '4px 10px', borderRadius: radius.pill,
            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
            {children}
        </span>
    );
}

// ───────────────────────── Button ─────────────────────────
type BtnVariant = 'orange' | 'indigo' | 'green' | 'ghost' | 'outline' | 'danger';
const BTN: Record<BtnVariant, React.CSSProperties> = {
    orange: { background: colors.orange, color: '#fff', border: 'none' },
    indigo: { background: colors.indigo, color: '#fff', border: 'none' },
    green: { background: colors.green, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: colors.textBody, border: 'none' },
    outline: { background: '#fff', color: colors.textBody, border: `1px solid ${colors.border}` },
    danger: { background: colors.redSoft, color: colors.redText, border: `1px solid #FCA5A5` },
};

export function Btn({
    children, onClick, variant = 'orange', icon, type = 'button', disabled, style, size = 'md',
}: {
    children: React.ReactNode; onClick?: () => void; variant?: BtnVariant;
    icon?: string; type?: 'button' | 'submit'; disabled?: boolean; style?: React.CSSProperties; size?: 'sm' | 'md';
}) {
    const pad = size === 'sm' ? '7px 12px' : '10px 16px';
    const fs = size === 'sm' ? 13 : 14;
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: pad, borderRadius: radius.sm, fontSize: fs, fontWeight: 600, fontFamily: font,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
                transition: 'filter .15s, transform .05s', whiteSpace: 'nowrap',
                ...BTN[variant], ...style,
            }}
            onMouseDown={(e) => { (e.currentTarget.style.transform = 'translateY(1px)'); }}
            onMouseUp={(e) => { (e.currentTarget.style.transform = 'translateY(0)'); }}
            onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = 'brightness(0.95)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
            {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
            {children}
        </button>
    );
}

// ───────────────────────── Tabs ─────────────────────────
export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
    return (
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
            {tabs.map((t) => {
                const isActive = t === active;
                return (
                    <button
                        key={t}
                        onClick={() => onChange(t)}
                        style={{
                            padding: '9px 18px', borderRadius: radius.pill, border: 'none', cursor: 'pointer',
                            fontSize: 14, fontWeight: 600, fontFamily: font,
                            background: isActive ? colors.navy900 : '#ECEDF3',
                            color: isActive ? colors.orange : colors.textMuted,
                            transition: 'all .15s',
                        }}
                    >
                        {t}
                    </button>
                );
            })}
        </div>
    );
}

// ───────────────────────── KpiCard ─────────────────────────
export function KpiCard({
    label, value, sub, icon, badge, badgeTone = 'green',
}: {
    label: string; value: string; sub?: string; icon: string;
    badge?: string; badgeTone?: Tone;
}) {
    return (
        <Card pad={20} style={{ flex: 1, minWidth: 210 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{
                    width: 42, height: 42, borderRadius: radius.md,
                    background: colors.orangeSoft, color: colors.orange,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Icon name={icon} size={22} />
                </div>
                {badge && <Badge tone={badgeTone}>{badge}</Badge>}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>{label}</p>
            <p style={{ margin: '4px 0 0 0', fontSize: 26, fontWeight: 700, color: colors.textStrong, letterSpacing: '-0.02em' }}>{value}</p>
            {sub && <p style={{ margin: '8px 0 0 0', fontSize: 12, color: colors.textFaint }}>{sub}</p>}
        </Card>
    );
}

// ───────────────────────── Progress ─────────────────────────
export function Progress({ value, color = colors.orange }: { value: number; color?: string }) {
    return (
        <div style={{ height: 7, borderRadius: 999, background: '#EDEFF4', overflow: 'hidden', width: '100%' }}>
            <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: '100%', background: color, borderRadius: 999 }} />
        </div>
    );
}

// ───────────────────────── Spinner / Empty ─────────────────────────
export function Loading({ text = 'Cargando…' }: { text?: string }) {
    return <p style={{ color: colors.textMuted, fontSize: 14, padding: '20px 0' }}>{text}</p>;
}

export function Empty({ text }: { text: string }) {
    return (
        <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textFaint }}>
            <p style={{ margin: 0, fontSize: 14 }}>{text}</p>
        </div>
    );
}

// ───────────────────────── Tabla helpers ─────────────────────────
export const tableStyles = {
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14, textAlign: 'left' as const },
    th: { padding: '12px 10px', color: colors.textMuted, fontWeight: 600, fontSize: 12.5, textTransform: 'uppercase' as const, letterSpacing: '0.03em', borderBottom: `1px solid ${colors.border}` },
    td: { padding: '14px 10px', color: colors.textBody, borderBottom: `1px solid ${colors.borderSoft}` },
};

// ───────────────────────── Inputs ─────────────────────────
export const inputStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: radius.sm, border: `1px solid ${colors.border}`,
    fontSize: 14, fontFamily: font, color: colors.textBody, outline: 'none', width: '100%', boxSizing: 'border-box',
    background: '#fff',
};

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: colors.textBody }}>{label}</label>
            {children}
        </div>
    );
}

// ───────────────────────── PasswordField ─────────────────────────
export function PasswordField({ value, onChange, placeholder, autoComplete, required, style }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
    autoComplete?: string; required?: boolean; style?: React.CSSProperties;
}) {
    const [visible, setVisible] = useState(false);
    return (
        <div style={{ position: 'relative' }}>
            <input
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete={autoComplete}
                required={required}
                style={{ ...inputStyle, paddingRight: 40, ...style }}
            />
            <button
                type="button"
                tabIndex={-1}
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    display: 'flex', color: colors.textFaint,
                }}
            >
                <Icon name={visible ? 'eyeOff' : 'eye'} size={17} />
            </button>
        </div>
    );
}

// ───────────────────────── Select ─────────────────────────
export function Select({ value, onChange, children, disabled, required, style }: {
    value: string | number; onChange: (value: string) => void;
    children: React.ReactNode; disabled?: boolean; required?: boolean; style?: React.CSSProperties;
}) {
    const { width, ...restStyle } = style || {};
    return (
        <div style={{ position: 'relative', width: width ?? '100%' }}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                required={required}
                style={{
                    ...inputStyle, ...restStyle, width: '100%',
                    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                    paddingRight: 36, cursor: disabled ? 'not-allowed' : 'pointer',
                    background: disabled ? '#F3F4F6' : (restStyle.background ?? '#fff'),
                }}
            >
                {children}
            </select>
            <span style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', color: colors.textFaint, display: 'flex',
            }}>
                <Icon name="chevronDown" size={16} />
            </span>
        </div>
    );
}

// ───────────────────────── Modal ─────────────────────────
export function Modal({ title, onClose, children, width = 520 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,19,40,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: radius.lg, width, maxWidth: '100%', maxHeight: '88vh', overflow: 'auto', fontFamily: font, boxShadow: shadow.pop }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${colors.border}`, position: 'sticky', top: 0, background: '#fff' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.textStrong }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, display: 'flex' }}>
                        <Icon name="x" size={20} />
                    </button>
                </div>
                <div style={{ padding: 24 }}>{children}</div>
            </div>
        </div>
    );
}

// ───────────────────────── Descarga CSV ─────────────────────────
export function downloadCSV(filename: string, rows: (string | number)[][]) {
    const escape = (v: string | number) => {
        const s = String(v ?? '');
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
    // BOM para que Excel respete acentos UTF-8
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
