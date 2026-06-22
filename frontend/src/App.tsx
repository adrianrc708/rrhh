import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Directorio from './components/Directorio';

// Verificador de Rutas Protegidas (Guardián)
const ProtectedRoute = ({ children, isAuthenticated }: { children: JSX.Element, isAuthenticated: boolean }) => {
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('token'));

    return (
        <BrowserRouter>
            <Routes>
                {/* Ruta Pública: Formulario de Autenticación */}
                <Route
                    path="/login"
                    element={!isAuthenticated ? <Login setAuth={setIsAuthenticated} /> : <Navigate to="/dashboard" />}
                />

                {/* Ruta Privada Protegida: Panel de Recursos Humanos */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute isAuthenticated={isAuthenticated}>
                            <Directorio />
                        </ProtectedRoute>
                    }
                />

                {/* Redirección por defecto */}
                <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
            </Routes>
        </BrowserRouter>
    );
}
