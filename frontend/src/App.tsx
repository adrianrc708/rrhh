import React, { useState } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Personal from './pages/Personal';
import Asistencia from './pages/Asistencia';
import Nomina from './pages/Nomina';
import Auditoria from './pages/Auditoria';
import Landing from './pages/Landing';
import IntroAnimation from './components/IntroAnimation';
import Admin from './pages/Admin';
import MiEspacio from './pages/MiEspacio';
import Kiosco from './pages/Kiosco';
import Organigrama from './pages/Organigrama';
import Beneficios from './pages/Beneficios';
import Aprobaciones from './pages/Aprobaciones';
import Cumplimiento from './pages/Cumplimiento';
import Configuracion from './pages/Configuracion';
import { ToastProvider } from './components/ui';
import { SectionKey, seccionPorDefectoEfectiva, puedeAccederEfectivo } from './auth/roles';

type AppStage = 'landing' | 'intro' | 'login' | 'app';

// Fase 3: el Kiosco facial es una interfaz aislada para tablets. Se activa con
// ?kiosco en la URL y NO usa la sesión de usuario (se autentica por dispositivo).
const esKiosco = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('kiosco');

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
    // Fase 1: la sección inicial la decide el rol (enrutamiento dinámico).
    // Fase 7: si hay override de secciones (roles personalizados), manda ese.
    const [section, setSection] = useState<SectionKey>(seccionPorDefectoEfectiva(savedUser?.rol, savedUser?.secciones));

    // Kiosco aislado: cortocircuita todo (sin login ni layout).
    if (esKiosco) return <Kiosco />;

    const logout = () => {
        localStorage.clear();
        setUser(null);
        setStage('login');
    };

    // Navegación segura: nunca deja al usuario en una sección fuera de su rol/override.
    const navegar = (s: SectionKey) => {
        setSection(puedeAccederEfectivo(user?.rol, s, user?.secciones) ? s : seccionPorDefectoEfectiva(user?.rol, user?.secciones));
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
                    setSection(seccionPorDefectoEfectiva(u.rol, (u as any).secciones));
                }}
                onBack={() => setStage('landing')}
            />
        );
    }

    // Guardia de render: si por cualquier motivo la sección activa no está permitida
    // para el rol, se cae a la sección por defecto (defensa en profundidad en el cliente;
    // el backend valida los permisos reales de cada endpoint).
    const seccionActiva: SectionKey = puedeAccederEfectivo(user.rol, section, user.secciones)
        ? section
        : seccionPorDefectoEfectiva(user.rol, user.secciones);

    return (
        <ToastProvider>
            <Layout
                active={seccionActiva}
                onNavigate={navegar}
                user={{ nombre: user.nombre || 'Usuario', rol: user.rol || '—', secciones: user.secciones }}
                onLogout={logout}
            >
                {seccionActiva === 'dashboard' && <Dashboard />}
                {seccionActiva === 'personal' && <Personal />}
                {seccionActiva === 'organigrama' && <Organigrama />}
                {seccionActiva === 'asistencia' && <Asistencia />}
                {seccionActiva === 'nomina' && <Nomina />}
                {seccionActiva === 'beneficios' && <Beneficios />}
                {seccionActiva === 'aprobaciones' && <Aprobaciones userRol={user.rol} />}
                {seccionActiva === 'cumplimiento' && <Cumplimiento />}
                {seccionActiva === 'configuracion' && <Configuracion userRol={user.rol} />}
                {seccionActiva === 'auditoria' && <Auditoria />}
                {seccionActiva === 'admin' && <Admin />}
                {seccionActiva === 'mi-espacio' && <MiEspacio />}
            </Layout>
        </ToastProvider>
    );
}
