import React, { useState } from 'react';
import api from '../services/api';
import { colors, radius, font, shadow } from '../theme';
import Icon from './Icons';
import { Btn } from './ui';

interface LoginProps {
    onLogin: (user: { nombre: string; rol: string; correo: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
    const [correo, setCorreo] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setCargando(true);
        try {
            const formData = new URLSearchParams();
            formData.append('username', correo);
            formData.append('password', password);

            const resp = await api.post('/core/login', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            localStorage.setItem('token', resp.data.access_token);

            // Traemos el perfil real del usuario autenticado
            let user = { nombre: correo.split('@')[0], rol: 'Usuario', correo };
            try {
                const me = await api.get('/core/usuarios/me');
                user = { nombre: me.data.nombre, rol: me.data.rol, correo: me.data.correo };
            } catch { /* fallback al provisional */ }
            localStorage.setItem('user', JSON.stringify(user));
            onLogin(user);
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (detail ? JSON.stringify(detail) : 'No se pudo conectar con el servidor.'));
        } finally {
            setCargando(false);
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', fontFamily: font }}>
            {/* Panel de marca */}
            <div style={{
                flex: 1, background: `linear-gradient(160deg, ${colors.navy900}, ${colors.navy700})`,
                color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{ width: 48, height: 48, borderRadius: radius.md, background: colors.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="building" size={26} color="#fff" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>Omnia</h1>
                </div>
                <p style={{ fontSize: 18, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', maxWidth: 440 }}>
                    Gestión centralizada de personal, asistencia y nómina con analítica predictiva de IA.
                </p>
                <div style={{ display: 'flex', gap: 28, marginTop: 40 }}>
                    {[['Personal', 'users'], ['Asistencia', 'clock'], ['Nómina', 'dollar'], ['Auditoría', 'shield']].map(([t, ic]) => (
                        <div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.85)' }}>
                            <div style={{ width: 44, height: 44, borderRadius: radius.md, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name={ic} size={22} />
                            </div>
                            <span style={{ fontSize: 12.5 }}>{t}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Panel de formulario */}
            <div style={{ width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, background: colors.bg }}>
                <div style={{ width: '100%', maxWidth: 360, background: '#fff', padding: 36, borderRadius: radius.lg, boxShadow: shadow.card, border: `1px solid ${colors.border}` }}>
                    <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Iniciar Sesión</h2>
                    <p style={{ margin: '0 0 24px', fontSize: 14, color: colors.textMuted }}>Ingresa tus credenciales corporativas</p>

                    {error && (
                        <div style={{ background: colors.redSoft, color: colors.redText, padding: '10px 12px', borderRadius: radius.sm, marginBottom: 18, fontSize: 13 }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: colors.textBody }}>Correo electrónico</label>
                            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required placeholder="admin@tech.com"
                                style={{ padding: '11px 12px', borderRadius: radius.sm, border: `1px solid ${colors.border}`, fontSize: 14, fontFamily: font, outline: 'none' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: colors.textBody }}>Contraseña</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••"
                                style={{ padding: '11px 12px', borderRadius: radius.sm, border: `1px solid ${colors.border}`, fontSize: 14, fontFamily: font, outline: 'none' }} />
                        </div>
                        <Btn type="submit" variant="orange" disabled={cargando} style={{ width: '100%', marginTop: 6, padding: '12px' }}>
                            {cargando ? 'Autenticando…' : 'Ingresar al Sistema'}
                        </Btn>
                    </form>
                </div>
            </div>
        </div>
    );
}
