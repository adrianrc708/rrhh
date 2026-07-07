import React, { useState } from 'react';
import api from '../services/api';
import { colors, font } from '../theme';
import { OmniaLogo } from './OmniaLogo';
import Icon from './Icons';
import PasarelaPago, { DatosPago, ResultadoPago } from './PasarelaPago';

interface LoginProps {
    onLogin: (user: { nombre: string; rol: string; correo: string }) => void;
    onBack?: () => void;
}

const orange = '#F97316';
const navy   = '#1A1C4B';

// ── Input con label ──────────────────────────────────────────────────────────
function Field({ label, type, value, onChange, placeholder, name, autoComplete }: {
    label: string; type: string; value: string;
    onChange: (v: string) => void; placeholder?: string; name?: string; autoComplete?: string;
}) {
    const [verPassword, setVerPassword] = useState(false);
    const esPassword = type === 'password';
    const tipoReal = esPassword && verPassword ? 'text' : type;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: colors.textBody }}>{label}</label>
            <div style={{ position: 'relative' }}>
                <input
                    type={tipoReal} value={value} required placeholder={placeholder}
                    name={name} autoComplete={autoComplete}
                    onChange={e => onChange(e.target.value)}
                    style={{
                        padding: '13px 16px', paddingRight: esPassword ? 46 : 16, borderRadius: 10,
                        border: `1.5px solid ${colors.border}`, width: '100%', boxSizing: 'border-box',
                        fontSize: 15, fontFamily: font, outline: 'none',
                        color: colors.textBody, background: '#fff',
                        transition: 'border-color .15s',
                    }}
                    onFocus={e  => (e.target.style.borderColor = orange)}
                    onBlur={e   => (e.target.style.borderColor = colors.border)}
                />
                {esPassword && (
                    <button
                        type="button" tabIndex={-1}
                        onClick={() => setVerPassword(v => !v)}
                        aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        style={{
                            position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                            display: 'flex', color: colors.textFaint,
                        }}
                    >
                        <Icon name={verPassword ? 'eyeOff' : 'eye'} size={19} />
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Botón principal ──────────────────────────────────────────────────────────
function SubmitBtn({ loading, children }: { loading: boolean; children: React.ReactNode }) {
    return (
        <button type="submit" disabled={loading} style={{
            marginTop: 8, padding: '15px', width: '100%',
            background: loading ? '#ccc' : orange,
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: font, transition: 'background .15s',
        }}>
            {loading ? 'Procesando…' : children}
        </button>
    );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Login({ onLogin, onBack }: LoginProps) {
    const [tab, setTab] = useState<'login' | 'registro'>('login');
    const [regStep, setRegStep] = useState<1 | 2>(1);

    // Login state
    const [correo,   setCorreo]   = useState('');
    const [password, setPassword] = useState('');

    // Registro state
    const [empresa,   setEmpresa]   = useState('');
    const [nombre,    setNombre]    = useState('');
    const [regCorreo, setRegCorreo] = useState('');
    const [regPass,   setRegPass]   = useState('');
    const [regPass2,  setRegPass2]  = useState('');

    const [error,    setError]    = useState('');
    const [loading,  setLoading]  = useState(false);

    const cambiarTab = (t: 'login' | 'registro') => { setTab(t); setError(''); setRegStep(1); };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const fd = new URLSearchParams();
            fd.append('username', correo); fd.append('password', password);
            const resp = await api.post('/core/login', fd, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
            localStorage.setItem('token', resp.data.access_token);
            let user: any = { nombre: correo.split('@')[0], rol: 'Usuario', correo };
            try { const me = await api.get('/core/usuarios/me'); user = { nombre: me.data.nombre, rol: me.data.rol, correo: me.data.correo, secciones: me.data.secciones ?? null }; } catch {}
            localStorage.setItem('user', JSON.stringify(user));
            onLogin(user);
        } catch (err: any) {
            const d = err?.response?.data?.detail;
            setError(typeof d === 'string' ? d : 'Correo o contraseña incorrectos.');
        } finally { setLoading(false); }
    };

    const avanzarAPago = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (regPass !== regPass2) { setError('Las contraseñas no coinciden.'); return; }
        if (regPass.length < 6)   { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
        setRegStep(2);
    };

    const procesarPago = async (datos: DatosPago): Promise<ResultadoPago> => {
        try {
            const resp = await api.post('/core/registro', {
                empresa_nombre: empresa, nombre, correo: regCorreo, password: regPass,
                plan: datos.plan, num_empleados: datos.numEmpleados,
                metodo_pago: datos.metodoPago, tarjeta_ultimos4: datos.tarjetaUltimos4,
            });
            localStorage.setItem('token', resp.data.access_token);
            const u = resp.data.usuario;
            const usuario = { nombre: u.nombre, rol: u.rol, correo: u.correo };
            localStorage.setItem('user', JSON.stringify(usuario));
            return { usuario, pago: resp.data.pago };
        } catch (err: any) {
            const d = err?.response?.data?.detail;
            throw new Error(typeof d === 'string' ? d : 'No se pudo procesar el pago. Inténtalo de nuevo.');
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: font, position: 'relative', overflow: 'hidden',
            background: `linear-gradient(135deg, #09090F 0%, ${navy} 55%, #1e2060 100%)`,
        }}>
            {/* Decoración de fondo */}
            <div style={{ position: 'absolute', top: '10%', left: '5%',  width: 400, height: 400, borderRadius: '50%', background: 'rgba(249,115,22,0.07)', filter: 'blur(80px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '8%', right: '4%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(49,46,129,0.4)',   filter: 'blur(80px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '50%', right: '20%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(249,115,22,0.04)', filter: 'blur(60px)', pointerEvents: 'none' }} />

            {/* Contenedor centrado */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: tab === 'registro' && regStep === 2 ? 620 : 560, padding: '20px 24px', transition: 'max-width .2s' }}>

                {/* Logo clickeable */}
                <div
                    onClick={onBack} title="Volver a la página principal"
                    style={{ marginBottom: 36, cursor: onBack ? 'pointer' : 'default', transition: 'opacity .2s' }}
                    onMouseEnter={e => { if (onBack) (e.currentTarget as HTMLDivElement).style.opacity = '0.7'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                >
                    <OmniaLogo variant="full" width={240} />
                </div>

                {/* Subtítulo */}
                <p style={{ margin: '0 0 32px', color: 'rgba(255,255,255,0.5)', fontSize: 16, textAlign: 'center', letterSpacing: '0.01em' }}>
                    Plataforma de RR.HH. para PYMEs peruanas
                </p>

                {/* Card */}
                <div style={{
                    width: '100%', background: '#fff',
                    borderRadius: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
                    overflow: 'hidden',
                }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
                        {(['login', 'registro'] as const).map(t => (
                            <button key={t} onClick={() => cambiarTab(t)} style={{
                                flex: 1, padding: '20px', border: 'none', cursor: 'pointer',
                                fontFamily: font, fontSize: 15, fontWeight: 700,
                                background: tab === t ? '#fff' : '#F8F9FB',
                                color: tab === t ? orange : colors.textMuted,
                                borderBottom: tab === t ? `3px solid ${orange}` : '3px solid transparent',
                                transition: 'all .15s',
                            }}>
                                {t === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                            </button>
                        ))}
                    </div>

                    {/* Formulario */}
                    <div style={{ padding: '36px 42px 40px' }}>
                        {error && (
                            <div style={{ background: colors.redSoft, color: colors.redText, padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13, fontWeight: 500 }}>
                                {error}
                            </div>
                        )}

                        {tab === 'login' ? (
                            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <Field label="Correo electrónico" type="email"    value={correo}   onChange={setCorreo}   placeholder="admin@empresa.com" name="email"    autoComplete="username" />
                                <Field label="Contraseña"         type="password" value={password} onChange={setPassword} placeholder="••••••••"          name="password" autoComplete="current-password" />
                                <SubmitBtn loading={loading}>Ingresar al Sistema</SubmitBtn>
                                <p style={{ margin: '4px 0 0', textAlign: 'center', fontSize: 13, color: colors.textFaint }}>
                                    ¿Aún no tienes cuenta?{' '}
                                    <button type="button" onClick={() => cambiarTab('registro')} style={{ background: 'none', border: 'none', color: orange, fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: font }}>
                                        Regístrate gratis
                                    </button>
                                </p>
                            </form>
                        ) : regStep === 1 ? (
                            <form onSubmit={avanzarAPago} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <Field label="Nombre de tu empresa"   type="text"     value={empresa}   onChange={setEmpresa}   placeholder="Mi Empresa S.A.C." name="organization" autoComplete="organization" />
                                <Field label="Tu nombre completo"     type="text"     value={nombre}    onChange={setNombre}    placeholder="Juan Pérez"        name="name"         autoComplete="name" />
                                <Field label="Correo electrónico"     type="email"    value={regCorreo} onChange={setRegCorreo} placeholder="juan@empresa.com"  name="email"        autoComplete="email" />
                                <Field label="Contraseña"           type="password" value={regPass}  onChange={setRegPass}  placeholder="Mínimo 6 caracteres" name="new-password"     autoComplete="new-password" />
                                <Field label="Confirmar contraseña" type="password" value={regPass2} onChange={setRegPass2} placeholder="Repetir contraseña"  name="confirm-password" autoComplete="new-password" />
                                <SubmitBtn loading={false}>Continuar a elegir plan →</SubmitBtn>
                                <p style={{ margin: '4px 0 0', textAlign: 'center', fontSize: 13, color: colors.textFaint }}>
                                    ¿Ya tienes cuenta?{' '}
                                    <button type="button" onClick={() => cambiarTab('login')} style={{ background: 'none', border: 'none', color: orange, fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: font }}>
                                        Iniciar sesión
                                    </button>
                                </p>
                            </form>
                        ) : (
                            <PasarelaPago
                                empresaNombre={empresa}
                                onBack={() => setRegStep(1)}
                                onPagar={procesarPago}
                                onDone={onLogin}
                            />
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
