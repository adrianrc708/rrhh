import React, { useState } from 'react';
import api from '../services/api';

interface LoginProps {
    setAuth: (val: boolean) => void;
}

export default function Login({ setAuth }: LoginProps) {
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

            const respuesta = await api.post('/core/login', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            localStorage.setItem('token', respuesta.data.access_token);

            // CONTROL INTELIGENTE: Si el backend no adjunta 'user', deducimos el rol por el correo
            if (respuesta.data.user) {
                localStorage.setItem('user', JSON.stringify(respuesta.data.user));
            } else {
                let rolDetectado = 'Personal';
                let nombreProvisional = correo.split('@')[0].toUpperCase();

                if (correo.includes('admin')) {
                    rolDetectado = 'Admin';
                } else if (correo.includes('rrhh')) {
                    rolDetectado = 'RRHH';
                } else if (correo.includes('gerente')) {
                    rolDetectado = 'Gerente';
                } else if (correo.includes('empleada')) {
                    rolDetectado = 'Empleado';
                }

                localStorage.setItem('user', JSON.stringify({
                    nombre: nombreProvisional,
                    rol: rolDetectado
                }));
            }

            // Dejamos un solo setAuth para cambiar de pantalla
            setAuth(true);

        } catch (err: any) {
            console.error("Error capturado en Login:", err);
            if (err.response && err.response.data) {
                const detail = err.response.data.detail;
                if (typeof detail === 'object') {
                    setError(JSON.stringify(detail));
                } else {
                    setError(String(detail) || 'Credenciales incorrectas');
                }
            } else {
                setError('No se pudo establecer conexión con el servidor backend');
            }
        } finally {
            setCargando(false);
        }
    };

    return (
        <div style={styles.contenedor}>
            <div style={styles.tarjeta}>
                <h2 style={styles.titulo}>Omnia HR — Iniciar Sesión</h2>
                <p style={styles.subtitulo}>Ingresa tus credenciales de Tech SA</p>

                {/* Renderizado seguro: 'error' ahora está garantizado que es un string */}
                {error && <div style={styles.error}>{error}</div>}

                <form onSubmit={handleLogin} style={styles.formulario}>
                    <label style={styles.label}>Correo Electrónico</label>
                    <input
                        type="email"
                        value={correo}
                        onChange={(e) => setCorreo(e.target.value)}
                        placeholder="rrhh@tech.com"
                        required
                        style={styles.input}
                    />

                    <label style={styles.label}>Contraseña</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        style={styles.input}
                    />

                    <button type="submit" disabled={cargando} style={styles.boton}>
                        {cargando ? 'Autenticando...' : 'Ingresar al Sistema'}
                    </button>
                </form>
            </div>
        </div>
    );
}

const styles = {
    contenedor: { display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' },
    tarjeta: { backgroundColor: '#ffffff', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
    titulo: { margin: '0 0 10px 0', fontSize: '24px', textAlign: 'center' as const, color: '#1f2937' },
    subtitulo: { margin: '0 0 20px 0', fontSize: '14px', textAlign: 'center' as const, color: '#6b7280' },
    error: { backgroundColor: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: '4px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' as const, wordBreak: 'break-word' as const },
    formulario: { display: 'flex', flexDirection: 'column' as const },
    label: { marginBottom: '5px', fontSize: '14px', fontWeight: 'bold', color: '#374151' },
    input: { padding: '10px', marginBottom: '20px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '16px' },
    boton: { padding: '12px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }
};