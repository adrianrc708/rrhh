import React, { useEffect, useState } from 'react';
import { colors, radius, font, shadow } from '../theme';
import api from '../services/api';
import Icon from '../components/Icons';

interface UsuarioAdmin {
    usuario_id: number;
    nombre: string;
    correo: string;
    rol: string;
    estado: string;
}

interface EmpresaAdmin {
    empresa_id: number;
    razon_social: string;
    ruc: string;
    plan_suscripcion: string;
    fecha_registro: string;
    usuarios: UsuarioAdmin[];
}

export default function Admin() {
    const [empresas, setEmpresas] = useState<EmpresaAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEmpresas = async () => {
            try {
                const res = await api.get('/api/admin/empresas');
                setEmpresas(res.data);
            } catch (err: any) {
                setError(err.response?.data?.detail || 'Error al cargar las empresas');
            } finally {
                setLoading(false);
            }
        };
        fetchEmpresas();
    }, []);

    if (loading) {
        return <div style={{ padding: 40, fontFamily: font }}>Cargando...</div>;
    }

    if (error) {
        return <div style={{ padding: 40, fontFamily: font, color: colors.red }}>{error}</div>;
    }

    return (
        <div style={{ fontFamily: font }}>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: colors.textStrong }}>Panel de Super Admin</h1>
                <p style={{ margin: 0, fontSize: 15, color: colors.textMuted }}>Gestión global de inquilinos (Empresas) registradas en Omnia.</p>
            </div>

            <div style={{ background: colors.card, borderRadius: radius.lg, border: `1px solid ${colors.border}`, boxShadow: shadow.card, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
                            <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID</th>
                            <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Razón Social / RUC</th>
                            <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan</th>
                            <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usuarios</th>
                            <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registro</th>
                        </tr>
                    </thead>
                    <tbody>
                        {empresas.map((emp) => (
                            <tr key={emp.empresa_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                <td style={{ padding: '18px 24px', fontSize: 14, color: colors.textStrong }}>#{emp.empresa_id}</td>
                                <td style={{ padding: '18px 24px' }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.textStrong }}>{emp.razon_social}</div>
                                    <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>RUC: {emp.ruc}</div>
                                </td>
                                <td style={{ padding: '18px 24px' }}>
                                    <span style={{ 
                                        background: colors.orangeSoft, color: colors.orangeText, 
                                        padding: '4px 10px', borderRadius: radius.pill, fontSize: 12, fontWeight: 600 
                                    }}>
                                        {emp.plan_suscripcion}
                                    </span>
                                </td>
                                <td style={{ padding: '18px 24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ color: colors.textFaint }}><Icon name="users" size={16} /></div>
                                        <span style={{ fontSize: 14, color: colors.textBody, fontWeight: 500 }}>{emp.usuarios.length}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: colors.textFaint, marginTop: 4 }}>
                                        Admin: {emp.usuarios.find(u => u.rol === 'Admin')?.nombre || 'N/A'}
                                    </div>
                                </td>
                                <td style={{ padding: '18px 24px', fontSize: 14, color: colors.textBody }}>
                                    {emp.fecha_registro ? new Date(emp.fecha_registro).toLocaleDateString() : 'N/A'}
                                </td>
                            </tr>
                        ))}
                        {empresas.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: colors.textMuted, fontSize: 14 }}>
                                    No hay empresas registradas.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
