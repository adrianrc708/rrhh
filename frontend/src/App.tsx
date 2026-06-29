import React, { useState } from 'react';
import Login from './components/Login';
import Layout, { SectionKey } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Personal from './pages/Personal';
import Asistencia from './pages/Asistencia';
import Nomina from './pages/Nomina';
import Auditoria from './pages/Auditoria';
import Landing from './pages/Landing';
import IntroAnimation from './components/IntroAnimation';
import { ToastProvider } from './components/ui';

type AppStage = 'landing' | 'intro' | 'login' | 'app';

function leerUsuario() {
    try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export default function App() {
    const token = localStorage.getItem('token');
    const savedUser = leerUsuario();

    // Si ya está autenticado, ir directo a la app
    const [stage, setStage] = useState<AppStage>(token && savedUser ? 'app' : 'landing');
    const [user, setUser] = useState<any>(savedUser);
    const [section, setSection] = useState<SectionKey>('dashboard');

    const logout = () => {
        localStorage.clear();
        setUser(null);
        setStage('login');
    };

    if (stage === 'landing') {
        return <Landing onEnter={() => setStage('intro')} />;
    }

    if (stage === 'intro') {
        return <IntroAnimation onFinish={() => setStage('login')} />;
    }

    if (stage === 'login' || !user) {
        return (
            <Login
                onLogin={(u) => {
                    setUser(u);
                    setStage('app');
                    setSection('dashboard');
                }}
                onBack={() => setStage('landing')}
            />
        );
    }

    return (
        <ToastProvider>
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
        </ToastProvider>
    );
}
