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
    | 'beneficios'    // Fase 5: gratificaciones, CTS, liquidaciones
    | 'aprobaciones'  // Fase 5: Gerente aprueba solicitudes / sobretiempo / evalúa
    | 'cumplimiento'  // Fase 6: PLAME, T-Registro, AFPnet, legajo, firma de boletas
    | 'configuracion' // Fase 7: facturación propia, roles y solicitudes de datos
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
    beneficios:  { key: 'beneficios',  label: 'Beneficios',  sub: 'Gratificaciones, CTS y ceses',    icon: 'dollar' },
    aprobaciones:{ key: 'aprobaciones',label: 'Aprobaciones',sub: 'Solicitudes y sobretiempo',       icon: 'clock' },
    cumplimiento:{ key: 'cumplimiento',label: 'Cumplimiento',sub: 'PLAME, AFPnet, legajo y firmas',   icon: 'file' },
    configuracion:{key: 'configuracion',label: 'Configuración',sub: 'Facturación, roles y accesos',  icon: 'shield' },
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
        // El SuperAdmin solo administra el SaaS (panel global). Para operar una
        // empresa concreta, la selecciona y recién ahí aparecen sus secciones
        // (ver SUPERADMIN_EMPRESA_KEYS).
        default: 'admin',
        sections: ['admin'],
    },
    Admin: {
        // Dueño/alta dirección de la PYME: visión completa de SU empresa.
        default: 'dashboard',
        sections: ['dashboard', 'personal', 'asistencia', 'nomina', 'beneficios', 'aprobaciones', 'cumplimiento', 'configuracion', 'auditoria'],
    },
    RRHH: {
        // Operador de nómina y talento: menos que el Admin (sin facturación/roles
        // ni auditoría interna, que son del dueño).
        default: 'personal',
        sections: ['dashboard', 'personal', 'asistencia', 'nomina', 'beneficios', 'aprobaciones', 'cumplimiento'],
    },
    Gerente: {
        // El Gerente aprueba nómina y ve a su equipo; sin auditoría global.
        default: 'dashboard',
        sections: ['dashboard', 'personal', 'asistencia', 'nomina', 'aprobaciones'],
    },
    Empleado: {
        // Autogestión: solo su propio espacio.
        default: 'mi-espacio',
        sections: ['mi-espacio'],
    },
};

// Secciones que un SuperAdmin ve cuando está "viendo" una empresa concreta
// (se comporta como el Admin de esa empresa). Se muestran además de 'admin'.
export const SUPERADMIN_EMPRESA_KEYS: SectionKey[] = [
    'dashboard', 'personal', 'asistencia', 'nomina', 'beneficios', 'aprobaciones', 'cumplimiento', 'auditoria',
];

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

// ============================================================================
// Fase 7 — Roles personalizados. Si el Admin definió un override de secciones para
// el usuario (llega en /me como `secciones`), sustituye a las secciones del rol.
// Estas variantes "efectivas" son las que usan Layout y App.
// ============================================================================

function overrideValido(override?: string[] | null): SectionKey[] | null {
    if (!override || override.length === 0) return null;
    const validas = override.filter((k): k is SectionKey => (k as SectionKey) in SECTIONS);
    return validas.length ? validas : null;
}

/** ¿El SuperAdmin está "viendo" una empresa concreta? (Modo empresa). */
export function viendoEmpresa(): boolean {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem('monitor_empresa_id');
}

/** Claves de sección efectivas para un usuario, considerando rol, override y modo empresa del SuperAdmin. */
function clavesEfectivas(rol?: string, override?: string[] | null): SectionKey[] {
    if (rol === 'SuperAdmin') {
        return viendoEmpresa() ? (['admin', ...SUPERADMIN_EMPRESA_KEYS]) : ['admin'];
    }
    const ov = overrideValido(override);
    if (ov) return ov;
    return configPorRol(rol).sections;
}

export function seccionesEfectivas(rol?: string, override?: string[] | null): NavMeta[] {
    return clavesEfectivas(rol, override).map((k) => SECTIONS[k]);
}

export function seccionPorDefectoEfectiva(rol?: string, override?: string[] | null): SectionKey {
    const keys = clavesEfectivas(rol, override);
    return keys[0] ?? 'mi-espacio';
}

export function puedeAccederEfectivo(rol: string | undefined, seccion: SectionKey, override?: string[] | null): boolean {
    return clavesEfectivas(rol, override).includes(seccion);
}
