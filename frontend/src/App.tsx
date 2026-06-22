import React, { useState } from 'react';
import Login from './components/Login';
import Layout, { SectionKey } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Personal from './pages/Personal';
import Asistencia from './pages/Asistencia';
import Nomina from './pages/Nomina';
import Auditoria from './pages/Auditoria';

function leerUsuario() {
    try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export default function App() {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [user, setUser] = useState<any>(leerUsuario());
    const [section, setSection] = useState<SectionKey>('dashboard');

    if (!token || !user) {
        return (
            <Login
                onLogin={(u) => {
                    setUser(u);
                    setToken(localStorage.getItem('token'));
                    setSection('dashboard');
                }}
            />
        );
    }

    const logout = () => {
        localStorage.clear();
        setToken(null);
        setUser(null);
    };

    return (
        <Layout
            active={section}
            onNavigate={setSection}
            user={{ nombre: user.nombre || 'Usuario', rol: user.rol || '—' }}
            onLogout={logout}
        >
            {section === 'dashboard' && <Dashboard />}
            {section === 'personal' && <Personal />}
            {section === 'asistencia' && <Asistencia />}
            {section === 'nomina' && <Nomina />}
            {section === 'auditoria' && <Auditoria />}
        </Layout>
    );
}
