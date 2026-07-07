// ============================================================================
// Fase 1 — Enrutamiento dinámico por rol (login unificado).
//
// Única fuente de verdad de: qué secciones existen, qué secciones ve cada rol y
// cuál es su pantalla de aterrizaje tras iniciar sesión. Layout construye el menú
// a partir de aquí y App decide la sección por defecto y bloquea el acceso a
// secciones no permitidas. Al añadir una sección nueva, se registra una sola vez.
// ============================================================================

export type SectionKey =
    | 'dashboard'
    | 'personal'
    | 'organigrama'
    | 'asistencia'
    | 'nomina'
    | 'auditoria'
    | 'admin'
    | 'mi-espacio';

export interface NavMeta {
    key: SectionKey;
    label: string;
    sub: string;
    icon: string;
}

// Metadatos de presentación de cada sección (usado por el sidebar).
export const SECTIONS: Record<SectionKey, NavMeta> = {
    admin:       { key: 'admin',       label: 'Super Admin', sub: 'Gestión global del SaaS',        icon: 'shield' },
    dashboard:   { key: 'dashboard',   label: 'Dashboard',   sub: 'Analítica predictiva de IA',      icon: 'dashboard' },
    personal:    { key: 'personal',    label: 'Personal',    sub: 'Directorio y estructura',         icon: 'users' },
    organigrama: { key: 'organigrama', label: 'Organigrama', sub: 'Estructura y línea de mando',      icon: 'building' },
    asistencia:  { key: 'asistencia',  label: 'Asistencia',  sub: 'Registros biométricos',           icon: 'clock' },
    nomina:      { key: 'nomina',      label: 'Nómina',      sub: 'Cálculos automatizados',          icon: 'dollar' },
    auditoria:   { key: 'auditoria',   label: 'Auditoría',   sub: 'Reportes de cumplimiento',        icon: 'shield' },
    'mi-espacio':{ key: 'mi-espacio',  label: 'Mi Espacio',  sub: 'Mis datos, contratos y boletas',  icon: 'file' },
};

interface RoleConfig {
    /** Sección de aterrizaje tras el login. */
    default: SectionKey;
    /** Secciones visibles/accesibles para el rol, en orden de menú. */
    sections: SectionKey[];
}

// Mapa rol -> configuración de navegación.
export const ROLE_CONFIG: Record<string, RoleConfig> = {
    SuperAdmin: {
        default: 'admin',
        sections: ['admin', 'personal', 'asistencia', 'nomina', 'auditoria'],
    },
    Admin: {
        default: 'dashboard',
        sections: ['dashboard', 'personal', 'organigrama', 'asistencia', 'nomina', 'auditoria'],
    },
    RRHH: {
        default: 'personal',
        sections: ['dashboard', 'personal', 'organigrama', 'asistencia', 'nomina', 'auditoria'],
    },
    Gerente: {
        // El Gerente aprueba nómina y ve a su equipo; sin auditoría global.
        default: 'dashboard',
        sections: ['dashboard', 'personal', 'organigrama', 'asistencia', 'nomina'],
    },
    Empleado: {
        // Autogestión: solo su propio espacio.
        default: 'mi-espacio',
        sections: ['mi-espacio'],
    },
};

// Fallback conservador para roles desconocidos: solo su espacio personal.
const FALLBACK: RoleConfig = { default: 'mi-espacio', sections: ['mi-espacio'] };

export function configPorRol(rol?: string): RoleConfig {
    return (rol && ROLE_CONFIG[rol]) || FALLBACK;
}

export function seccionesPorRol(rol?: string): NavMeta[] {
    return configPorRol(rol).sections.map((k) => SECTIONS[k]);
}

export function seccionPorDefecto(rol?: string): SectionKey {
    return configPorRol(rol).default;
}

export function puedeAcceder(rol: string | undefined, seccion: SectionKey): boolean {
    return configPorRol(rol).sections.includes(seccion);
}
