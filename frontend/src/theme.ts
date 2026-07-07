// Sistema de diseño — paleta y tokens (basado en el Figma "Interfaz SaaS RR.HH.")

export const colors = {
    // Marca / sidebar
    navy900: '#1A1C4B',
    navy800: '#23255C',
    navy700: '#2E3070',
    indigo: '#312E81',     // botones secundarios oscuros (Exportar / Descargar)
    indigoHover: '#3B379B',

    // Acento naranja
    orange: '#F97316',
    orangeHover: '#EA6A0C',
    orangeSoft: '#FFEDD5',
    orangeText: '#C2410C',

    // Estados
    green: '#16A34A',
    greenSoft: '#DCFCE7',
    greenText: '#15803D',
    blue: '#2563EB',
    blueSoft: '#DBEAFE',
    blueText: '#1D4ED8',
    amber: '#F59E0B',
    amberSoft: '#FEF3C7',
    amberText: '#B45309',
    purpleSoft: '#EDE9FE',
    purpleText: '#6D28D9',
    redSoft: '#FEE2E2',
    redText: '#B91C1C',
    red: '#EF4444',

    // Superficies y texto
    bg: '#F6F7FB',
    card: '#FFFFFF',
    border: '#EAECF2',
    borderSoft: '#F1F2F6',
    textStrong: '#1A1C4B',
    textBody: '#374151',
    textMuted: '#6B7280',
    textFaint: '#9CA3AF',
};

export const radius = {
    sm: '8px',
    md: '12px',
    lg: '16px',
    pill: '999px',
};

export const shadow = {
    card: '0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)',
    cardHover: '0 8px 24px rgba(16,24,40,0.10)',
    pop: '0 12px 32px rgba(16,24,40,0.18)',
};

export const font =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
