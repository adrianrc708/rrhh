import React, { useState } from 'react';
import { OmniaLogo } from '../components/OmniaLogo';

const navy = '#1A1C4B';
const navyDark = '#0F1030';
const orange = '#F97316';
const orangeHover = '#EA6A0C';
const font = "'Inter', -apple-system, sans-serif";

// ── Iconos SVG inline ────────────────────────────────────────────────────────
const Ico = ({ d, size = 22 }: { d: string; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

const ICONS = {
    nomina:      'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    ia:          'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2',
    biometria:   'M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4M2 12a10 10 0 0 0 10 10c1.93 0 3.68-.55 5.2-1.5M2 12h3m16.9-2c.06.66.1 1.32.1 2 0 3.5-1.8 6.6-4.5 8.5M12 7a5 5 0 0 1 5 5c0 .86-.22 1.61-.5 2.3',
    sunafil:     'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    plug:        'M7 2v11m10-11v11M3 12h18M12 16v6m-3-3h6M5 12a7 7 0 0 0 14 0',
    soles:       'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.86 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.37 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z',
    scale:       'M12 3v18M3 9h18M3 9l9-6 9 6M5 21h14',
    arrow:       'M5 12h14M12 5l7 7-7 7',
    star:        'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    check:       'M20 6L9 17l-5-5',
    info:        'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8h.01M12 12v4',
    building:    'M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.85',
    users:       'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    clock:       'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2',
    trending:    'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
};

// ── Componentes ──────────────────────────────────────────────────────────────
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
    const [hov, setHov] = useState(false);
    return (
        <a href={href}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                color: hov ? '#fff' : 'rgba(255,255,255,0.72)',
                textDecoration: 'none', fontSize: 15, fontWeight: 500,
                transition: 'color .15s', padding: '4px 0',
                borderBottom: hov ? `1px solid ${orange}` : '1px solid transparent',
            }}>
            {children}
        </a>
    );
}

function Btn({ children, primary, onClick, big, outlined }: {
    children: React.ReactNode; primary?: boolean; outlined?: boolean;
    onClick?: () => void; big?: boolean;
}) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                padding: big ? '15px 36px' : '10px 22px',
                fontSize: big ? 15 : 13.5,
                fontWeight: 700, fontFamily: font, cursor: 'pointer',
                borderRadius: 999,
                border: primary ? 'none' : outlined ? `1.5px solid rgba(255,255,255,0.3)` : `1.5px solid rgba(255,255,255,0.2)`,
                background: primary ? (hov ? orangeHover : orange) : hov ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: '#fff', transition: 'all .18s', letterSpacing: '0.01em', whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
        >{children}</button>
    );
}

function FeatureCard({ iconKey, title, desc }: { iconKey: keyof typeof ICONS; title: string; desc: string }) {
    const [hov, setHov] = useState(false);
    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${hov ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 16, padding: '32px 28px', flex: '1 1 220px', minWidth: 200,
                transition: 'all .2s', transform: hov ? 'translateY(-5px)' : 'none',
            }}>
            <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(249,115,22,0.12)', color: orange,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
            }}>
                <Ico d={ICONS[iconKey]} size={22} />
            </div>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: '#fff' }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>{desc}</p>
        </div>
    );
}

function PlanCard({ name, price, sub, features, highlighted, onEnter }: {
    name: string; price: string; sub: string;
    features: string[]; highlighted?: boolean; onEnter: () => void;
}) {
    return (
        <div style={{
            background: highlighted ? `linear-gradient(160deg, ${navy}, #252760)` : 'rgba(255,255,255,0.03)',
            border: `1.5px solid ${highlighted ? orange : 'rgba(255,255,255,0.09)'}`,
            borderRadius: 20, padding: '36px 30px', flex: '1 1 260px', minWidth: 240,
            position: 'relative', display: 'flex', flexDirection: 'column',
        }}>
            {highlighted && (
                <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: orange, color: '#fff', fontSize: 11, fontWeight: 800,
                    padding: '4px 16px', borderRadius: 999, letterSpacing: '0.08em', whiteSpace: 'nowrap',
                }}>MÁS POPULAR</div>
            )}
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: orange, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{name}</p>
            <div style={{ margin: '8px 0 2px', lineHeight: 1 }}>
                <span style={{ fontSize: 44, fontWeight: 900, color: '#fff' }}>{price}</span>
            </div>
            <p style={{ margin: '0 0 26px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{sub}</p>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 28 }}>
                {features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ color: orange, flexShrink: 0, marginTop: 1 }}>
                            <Ico d={ICONS.check} size={15} />
                        </span>
                        <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.45 }}>{f}</span>
                    </div>
                ))}
            </div>
            <button onClick={onEnter} style={{
                width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                background: highlighted ? orange : 'rgba(255,255,255,0.09)',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: font, transition: 'background .18s',
            }}
                onMouseEnter={e => (e.currentTarget.style.background = highlighted ? orangeHover : 'rgba(255,255,255,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = highlighted ? orange : 'rgba(255,255,255,0.09)')}
            >Empezar ahora</button>
        </div>
    );
}

function Pillar({ iconKey, title, desc }: { iconKey: keyof typeof ICONS; title: string; desc: string }) {
    return (
        <div style={{ textAlign: 'center', flex: '1 1 200px', padding: '0 20px' }}>
            <div style={{
                width: 66, height: 66, borderRadius: '50%',
                background: 'rgba(249,115,22,0.12)', border: '1.5px solid rgba(249,115,22,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: orange, margin: '0 auto 20px',
            }}>
                <Ico d={ICONS[iconKey]} size={26} />
            </div>
            <h3 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800, color: '#fff' }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75 }}>{desc}</p>
        </div>
    );
}

// ── Calculadora de Precios ───────────────────────────────────────────────────
const MAX_COLABORADORES = 9999; // sin límite práctico: cualquier empresa, sin importar el tamaño
const PLANES = [
    { nombre: 'Plan Micro',       min: 1,   max: 15,       precio: 12, color: '#6366F1' },
    { nombre: 'Plan Estándar',    min: 16,  max: 100,      precio: 10, color: orange },
    { nombre: 'Plan Corporativo', min: 101, max: Infinity, precio: 8,  color: '#16A34A' },
];
const BUK_MIN = 290; // tarifa mínima referencial competencia

function CalculadoraPrecios({ onEnter }: { onEnter: () => void }) {
    const [empleados, setEmpleados] = useState(10);

    const plan = PLANES.find(p => empleados >= p.min && empleados <= p.max) ?? PLANES[2];
    const totalMes = plan.precio * empleados;
    const totalAno = totalMes * 12;
    const costoCompetencia = Math.max(BUK_MIN, empleados * 15); // estimado competencia
    const ahorroMes = costoCompetencia - totalMes;
    const ahorroAno = ahorroMes * 12;
    const pct = Math.round((ahorroMes / costoCompetencia) * 100);

    return (
        <section style={{ background: `linear-gradient(180deg, #171940 0%, ${navyDark} 100%)`, padding: '100px 60px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ maxWidth: 860, margin: '0 auto' }}>
                {/* Título */}
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <p style={{ color: orange, fontWeight: 700, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>Calculadora de precios</p>
                    <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                        ¿Cuánto pagarías con Omnia?
                    </h2>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>Mueve el slider y calcula tu inversión mensual en tiempo real.</p>
                </div>

                {/* Card calculadora */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: '48px 52px' }}>

                    {/* Slider */}
                    <div style={{ marginBottom: 40 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                            <label style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>Número de colaboradores</label>
                            <input
                                type="number" min={1} max={MAX_COLABORADORES} value={empleados}
                                onChange={e => {
                                    const v = Math.round(Number(e.target.value));
                                    setEmpleados(Number.isFinite(v) && v > 0 ? Math.min(v, MAX_COLABORADORES) : 1);
                                }}
                                style={{
                                    fontSize: 36, fontWeight: 900, color: plan.color, background: 'transparent',
                                    border: 'none', outline: 'none', textAlign: 'right', width: 110,
                                    fontFamily: font,
                                }}
                            />
                        </div>
                        <input
                            type="range" min={1} max={500} value={Math.min(empleados, 500)}
                            onChange={e => setEmpleados(Number(e.target.value))}
                            style={{ width: '100%', accentColor: plan.color, height: 6, cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                            <span>1</span><span>100</span><span>200</span><span>300</span><span>400</span><span>500+</span>
                        </div>
                        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
                            ¿Más de 500 colaboradores? Escribe el número exacto arriba — no hay límite.
                        </p>
                    </div>

                    {/* Plan activo */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: `${plan.color}20`, border: `1px solid ${plan.color}60`,
                        borderRadius: 999, padding: '6px 18px', marginBottom: 32,
                    }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: plan.color }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: plan.color }}>{plan.nombre} · S/ {plan.precio}/usuario</span>
                    </div>

                    {/* Resultados */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
                        {[
                            { label: 'Costo mensual Omnia',      val: `S/ ${totalMes.toLocaleString('es-PE')}`,     sub: `${empleados} usuarios × S/ ${plan.precio}`,      color: '#fff' },
                            { label: 'Costo anual Omnia',        val: `S/ ${totalAno.toLocaleString('es-PE')}`,     sub: '12 meses sin penalidad',                          color: '#fff' },
                            { label: 'Ahorro mensual estimado',  val: `S/ ${ahorroMes.toLocaleString('es-PE')}`,   sub: `vs. tarifa referencial competencia`,               color: '#4ADE80' },
                            { label: 'Ahorro anual estimado',    val: `S/ ${ahorroAno.toLocaleString('es-PE')}`,   sub: `${pct}% menos que la competencia`,                 color: '#4ADE80' },
                        ].map(r => (
                            <div key={r.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px' }}>
                                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{r.label}</p>
                                <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 900, color: r.color, lineHeight: 1 }}>{r.val}</p>
                                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{r.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <div style={{ marginTop: 36, textAlign: 'center' }}>
                        <button onClick={onEnter} style={{
                            padding: '14px 40px', background: orange, color: '#fff',
                            border: 'none', borderRadius: 999, fontSize: 15, fontWeight: 700,
                            cursor: 'pointer', fontFamily: font,
                        }}
                            onMouseEnter={e => (e.currentTarget.style.background = orangeHover)}
                            onMouseLeave={e => (e.currentTarget.style.background = orange)}
                        >
                            Empezar con {plan.nombre} →
                        </button>
                        <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.3)' }}>
                            Sin tarjeta de crédito · Cambia de plan cuando quieras
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ── Landing Page ─────────────────────────────────────────────────────────────
export default function Landing({ onEnter }: { onEnter: () => void }) {
    return (
        <div style={{ background: navyDark, color: '#fff', fontFamily: font, overflowX: 'hidden' }}>

            {/* ── NAVBAR ── */}
            <nav style={{
                position: 'sticky', top: 0, zIndex: 100,
                background: 'rgba(13,14,38,0.92)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 60px', height: 68,
            }}>
                {/* Logo */}
                <OmniaLogo variant="compact" width={170} />

                {/* Links centrados */}
                {/* marginRight fijo: con justify-content:space-between el hueco hacia "Acciones"
                    se achica en pantallas medianas (el bloque de acciones es ancho); esto
                    garantiza aire respecto al botón "Modo Kiosco" sin importar el viewport. */}
                <div style={{ display: 'flex', gap: 40, alignItems: 'center', marginRight: 32 }}>
                    <NavLink href="#funcionalidades">Funcionalidades</NavLink>
                    <NavLink href="#precios">Precios</NavLink>
                    <NavLink href="#pilares">Por qué Omnia</NavLink>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={() => { window.location.href = '?kiosco'; }} title="Abrir el kiosco de marcación facial en esta tablet" style={{
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.75)',
                        fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: font,
                        padding: '7px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6,
                    }}>Modo Kiosco</button>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginRight: 4 }}>¿Ya tienes cuenta?</span>
                    <button onClick={onEnter} style={{
                        background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)',
                        fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: font,
                        padding: '6px 4px', textDecoration: 'underline', textUnderlineOffset: 3,
                    }}>Iniciar sesión</button>
                    <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.12)', margin: '0 6px' }} />
                    <Btn primary onClick={onEnter}>Registrar empresa</Btn>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section style={{
                minHeight: '88vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', textAlign: 'center', padding: '80px 24px',
                background: `radial-gradient(ellipse at 50% 0%, rgba(249,115,22,0.15) 0%, transparent 55%),
                             linear-gradient(180deg, #0D0F28 0%, #1A1C4B 100%)`,
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: '20%', left: '6%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(249,115,22,0.05)', filter: 'blur(70px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '8%', right: '4%', width: 240, height: 240, borderRadius: '50%', background: 'rgba(49,46,129,0.35)', filter: 'blur(70px)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', maxWidth: 820 }}>
                    {/* Badge */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
                        borderRadius: 999, padding: '7px 18px', fontSize: 13, fontWeight: 600,
                        color: orange, marginBottom: 32, letterSpacing: '0.03em',
                    }}>
                        <span style={{ color: orange }}><Ico d={ICONS.star} size={14} /></span>
                        Software RR.HH. hecho para PYMEs peruanas
                    </div>

                    <h1 style={{ margin: '0 0 24px', fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em' }}>
                        Gestiona tu equipo<br />
                        <span style={{ color: orange }}>sin Excel,</span> sin multas,<br />sin sorpresas.
                    </h1>
                    <p style={{ margin: '0 0 40px', fontSize: 'clamp(15px, 1.8vw, 19px)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, maxWidth: 580, marginLeft: 'auto', marginRight: 'auto' }}>
                        Omnia es el único SaaS de RR.HH. que combina nómina automatizada, biometría facial, IA predictiva de ausentismo y cumplimiento SUNAFIL — todo facturado en soles peruanos.
                    </p>
                    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Btn primary big onClick={onEnter}>
                            <Ico d={ICONS.arrow} size={16} /> Registrar empresa
                        </Btn>
                        <Btn big><a href="#precios" style={{ color: '#fff', textDecoration: 'none' }}>Ver planes y precios</a></Btn>
                    </div>
                    <p style={{ margin: '22px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.03em' }}>Sin tarjeta de crédito · Implementación en 24h · Soporte en español</p>
                </div>
            </section>

            {/* ── STATS BAR ── */}
            <section style={{ background: 'rgba(255,255,255,0.025)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '28px 60px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 24, maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
                    {[
                        { iconKey: 'soles' as const,    val: 'S/ 12',   label: 'por usuario activo / mes' },
                        { iconKey: 'clock' as const,    val: '< 24h',   label: 'tiempo de implementación' },
                        { iconKey: 'trending' as const, val: '100%',    label: 'facturado en soles peruanos' },
                        { iconKey: 'sunafil' as const,  val: 'SUNAFIL', label: 'cumplimiento normativo incluido' },
                    ].map(s => (
                        <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <div style={{ color: orange }}><Ico d={ICONS[s.iconKey]} size={20} /></div>
                            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>{s.val}</div>
                            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FUNCIONALIDADES ── */}
            <section id="funcionalidades" style={{ padding: '100px 60px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <p style={{ color: orange, fontWeight: 700, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>Plataforma completa</p>
                    <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.02em' }}>Todo lo que necesitas en un solo lugar</h2>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 16, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>Desde la nómina hasta la asistencia biométrica, cubierto de forma nativa y sin integraciones complicadas.</p>
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <FeatureCard iconKey="nomina"    title="Nómina Automatizada"       desc="Cálculo de planillas con ONP, AFP, IR 5ta categoría y EsSalud según normativa peruana actualizada. Exportación directa a SUNAT." />
                    <FeatureCard iconKey="ia"        title="IA Predictiva de Ausentismo" desc="Anticipa ausencias antes de que ocurran. Nuestro motor analiza patrones históricos para que planifiques con anticipación." />
                    <FeatureCard iconKey="biometria" title="Reconocimiento facial"       desc="Marcación por rostro desde una tablet en la puerta, sin comprar hardware biométrico. La cámara web es tu reloj de asistencia." />
                    <FeatureCard iconKey="sunafil"   title="Cumplimiento SUNAFIL"       desc="Actualizaciones normativas automáticas. Registros listos para fiscalización y exportación a entidades regulatorias." />
                </div>
            </section>

            {/* ── PILARES ── */}
            <section id="pilares" style={{ background: `linear-gradient(180deg, ${navyDark} 0%, #171940 100%)`, padding: '100px 60px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 70 }}>
                        <p style={{ color: orange, fontWeight: 700, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>Nuestros pilares</p>
                        <h2 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.02em' }}>Tres promesas sin letras chicas</h2>
                    </div>
                    <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <Pillar iconKey="plug"   title="Sin Fricción" desc="Usa tu reloj biométrico actual. No necesitas comprar hardware nuevo ni contratar técnicos. Conecta y listo." />
                        <Pillar iconKey="soles"  title="Sin Sustos"   desc="Precio fijo en soles, sin indexación al dólar ni tarifas ocultas. Lo que ves en la factura es exactamente lo que pagas." />
                        <Pillar iconKey="scale"  title="Sin Multas"   desc="Motor normativo actualizado automáticamente con cada cambio de SUNAFIL. Tú trabaja, nosotros vigilamos las leyes." />
                    </div>
                </div>
            </section>

            {/* ── PRECIOS ── */}
            <section id="precios" style={{ padding: '100px 60px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <p style={{ color: orange, fontWeight: 700, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>Precios transparentes</p>
                    <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.02em' }}>Planes que crecen contigo</h2>
                    <p style={{ margin: '0 0 18px', color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>En soles peruanos. Sin IGV. Sin contratos anuales obligatorios.</p>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
                        borderRadius: 999, padding: '7px 18px', fontSize: 13, color: 'rgba(255,255,255,0.65)',
                    }}>
                        <span style={{ color: orange }}><Ico d={ICONS.info} size={14} /></span>
                        Desde S/ 12 por usuario activo vs. S/ 290 mínimo de la competencia
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'stretch' }}>
                    <PlanCard name="Plan Micro" price="S/ 12"
                        sub="por usuario activo / mes · 1 a 15 empleados"
                        features={['Directorio de colaboradores','Gestión de contratos laborales','Control de asistencia básico','Nómina y boletas de pago','Registro de inasistencias','Portal del empleado','Soporte por correo']}
                        onEnter={onEnter} />
                    <PlanCard name="Plan Estándar" price="S/ 10" highlighted
                        sub="por usuario activo / mes · 16 a 100 empleados"
                        features={['Todo en Plan Micro','IA predictiva de ausentismo','Reconocimiento facial en tablet','Auditoría y registro de eventos','Reportes avanzados CSV/Excel','Notificaciones de vencimiento','Soporte prioritario en español']}
                        onEnter={onEnter} />
                    <PlanCard name="Plan Corporativo" price="A medida"
                        sub="100+ empleados · Precio según volumen"
                        features={['Todo en Plan Estándar','API personalizada e integraciones','SLA dedicado 99.9% uptime','Onboarding especializado','Gerente de cuenta asignado','Capacitación al equipo interno','Facturación personalizada']}
                        onEnter={onEnter} />
                </div>
            </section>

            {/* ── CALCULADORA ── */}
            <CalculadoraPrecios onEnter={onEnter} />

            {/* ── CTA FINAL ── */}
            <section style={{ background: `linear-gradient(135deg, ${navy} 0%, #1e2060 100%)`, padding: '100px 60px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
                    {['Nómina en soles', 'Biometría facial', 'Cumplimiento SUNAFIL', 'Soporte en español'].map(tag => (
                        <span key={tag} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '5px 16px', fontSize: 12.5, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{tag}</span>
                    ))}
                </div>
                <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(28px, 4vw, 50px)', fontWeight: 900, letterSpacing: '-0.025em' }}>¿Listo para digitalizar tu RR.HH.?</h2>
                <p style={{ margin: '0 0 38px', fontSize: 17, color: 'rgba(255,255,255,0.55)', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
                    Únete a las PYMEs peruanas que ya dejaron atrás los Excel manuales y las multas de SUNAFIL.
                </p>
                <Btn primary big onClick={onEnter}>
                    <Ico d={ICONS.arrow} size={16} /> Ingresar a Omnia
                </Btn>
            </section>

            {/* ── FOOTER ── */}
            <footer style={{ background: '#080920', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '28px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <OmniaLogo variant="compact" width={130} />
<p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.25)' }}>© 2025 Omnia · Software RR.HH. para PYMEs peruanas</p>
            </footer>
        </div>
    );
}
