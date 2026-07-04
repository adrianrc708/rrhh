import axios from 'axios';

// Jalamos la URL dinámicamente desde el archivo .env
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

// Interceptor automático para inyectar el token JWT en las cabeceras HTTP
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Inyectar Tenant ID si existe (usado por SuperAdmin para Modo Monitor)
    const tenantId = localStorage.getItem('monitor_empresa_id');
    if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
    }
    
    return config;
});

export default api;