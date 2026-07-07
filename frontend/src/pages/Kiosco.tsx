import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { colors, font, radius } from '../theme';
import { OmniaLogo } from '../components/OmniaLogo';
import Icon from '../components/Icons';
import CamaraFacial, { CamaraHandle } from '../components/CamaraFacial';

// ============================================================================
// Fase 3 — Kiosco Facial (interfaz aislada para tablets).
//
// No usa la sesión de usuario: se autentica con el token del dispositivo
// (X-Device-Token). Se activa con ?kiosco en la URL, fuera del Login/Layout.
// ============================================================================

// Instancia axios dedicada: NO inyecta el JWT de usuario, solo el token de dispositivo.
const kioscoApi = axios.create({ baseURL: import.meta.env.VITE_API_URL });

const LS_TOKEN = 'kiosk_device_token';
const LS_NOMBRE = 'kiosk_device_nombre';
const POLL_PRESENCIA = 250;      // chequeo liviano de "¿hay alguien enfrente?"
const ESTABLE_ANTES_DE_CAPTURAR = 500; // exige rostro sostenido para no capturar un frame borroso de paso
const PAUSA_TRAS_MARCAR = 5000;

type Resultado = { nombre: string; tipo: string; hora: string } | null;

export default function Kiosco() {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(LS_TOKEN));
    const [nombreDisp, setNombreDisp] = useState<string>(() => localStorage.getItem(LS_NOMBRE) || '');

    if (!token) {
        return <Provisionar onListo={(t, n) => { setToken(t); setNombreDisp(n); }} />;
    }
    return <Escaner token={token} nombreDisp={nombreDisp} onSalir={() => { localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_NOMBRE); setToken(null); }} />;
}

// ── Provisionamiento (token + PIN, una sola vez) ─────────────────────────────
function Provisionar({ onListo }: { onListo: (token: string, nombre: string) => void }) {
    const [token, setTok] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const verificar = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setCargando(true);
        try {
            const res = await kioscoApi.post('/kiosco/verificar', { token, pin });
            localStorage.setItem(LS_TOKEN, token);
            localStorage.setItem(LS_NOMBRE, res.data.nombre || 'Kiosco');
            onListo(token, res.data.nombre || 'Kiosco');
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'No se pudo validar el dispositivo.');
        } finally { setCargando(false); }
    };

    // Sin token/PIN aún no hay forma de entrar al kiosco: el logo es la única salida
    // de vuelta a la landing (quita "?kiosco" de la URL y recarga la app normal).
    const salirDelKiosco = () => { window.location.href = window.location.origin + window.location.pathname; };

    return (
        <Contenedor>
            <div style={{ background: '#fff', borderRadius: 24, padding: '40px 44px', width: 440, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
                <div
                    onClick={salirDelKiosco} title="Salir del modo kiosco"
                    style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, cursor: 'pointer' }}
                >
                    <OmniaLogo variant="full" width={200} sobreClaro />
                </div>
                <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: colors.textStrong, textAlign: 'center' }}>Activar Kiosco</h2>
                <p style={{ margin: '0 0 24px', fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>Ingresa el token y PIN del dispositivo (te lo entrega RRHH).</p>
                {error && <div style={{ background: colors.redSoft, color: colors.redText, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
                <form onSubmit={verificar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <input value={token} onChange={(e) => setTok(e.target.value)} placeholder="Token del dispositivo" required
                        style={{ padding: '13px 16px', borderRadius: 10, border: `1.5px solid ${colors.border}`, fontSize: 15, fontFamily: font }} />
                    <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" required type="password"
                        style={{ padding: '13px 16px', borderRadius: 10, border: `1.5px solid ${colors.border}`, fontSize: 15, fontFamily: font }} />
                    <button type="submit" disabled={cargando} style={{ marginTop: 6, padding: 15, background: colors.orange, color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                        {cargando ? 'Validando…' : 'Activar dispositivo'}
                    </button>
                </form>
            </div>
        </Contenedor>
    );
}

// ── Escáner biométrico continuo ──────────────────────────────────────────────
function Escaner({ token, nombreDisp, onSalir }: { token: string; nombreDisp: string; onSalir: () => void }) {
    const camaraRef = useRef<CamaraHandle>(null);
    const ocupado = useRef(false);
    const [estado, setEstado] = useState<'escaneando' | 'pausa'>('escaneando');
    const [resultado, setResultado] = useState<Resultado>(null);
    const [aviso, setAviso] = useState('');
    const [hora, setHora] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setHora(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // En vez de intentar marcar "a ciegas" cada X segundos, esperamos a ver un
    // rostro sostenido frente a la cámara (evita descriptores de un frame borroso
    // y hace que el escaneo se sienta instantáneo apenas alguien se para enfrente).
    const vistoDesde = useRef<number | null>(null);

    useEffect(() => {
        const id = setInterval(async () => {
            if (ocupado.current || estado === 'pausa') return;
            const cam = camaraRef.current;
            if (!cam || !cam.listo) return;

            if (!cam.rostroDetectado) { vistoDesde.current = null; return; }
            if (vistoDesde.current === null) { vistoDesde.current = Date.now(); return; }
            if (Date.now() - vistoDesde.current < ESTABLE_ANTES_DE_CAPTURAR) return;

            ocupado.current = true;
            try {
                const descriptor = await cam.capturarDescriptor();
                if (!descriptor) { ocupado.current = false; return; }
                let coords: { lat?: number; lng?: number } = {};
                try {
                    const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 2000 }));
                    coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                } catch { /* GPS opcional en el kiosco */ }

                const res = await kioscoApi.post('/kiosco/marcar', { descriptor, ...coords }, { headers: { 'X-Device-Token': token } });
                const d = res.data;
                setResultado({ nombre: d.nombre, tipo: d.tipo, hora: new Date(d.momento).toLocaleTimeString('es-PE') });
                setAviso('');
                setEstado('pausa');
                setTimeout(() => { setResultado(null); setEstado('escaneando'); }, PAUSA_TRAS_MARCAR);
            } catch (err: any) {
                if (err?.response?.status === 404) {
                    setAviso('Rostro no reconocido. Acércate e intenta de nuevo.');
                    setTimeout(() => setAviso(''), 2500);
                } else if (err?.response?.status === 401) {
                    setAviso('Dispositivo no autorizado.');
                }
            } finally {
                ocupado.current = false;
                vistoDesde.current = null; // exige alejarse y volver a acercarse para el próximo intento
            }
        }, POLL_PRESENCIA);
        return () => clearInterval(id);
    }, [estado, token]);

    const esEntrada = resultado?.tipo === 'entrada';

    return (
        <Contenedor>
            <button onClick={onSalir} title="Desvincular dispositivo"
                style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: font, fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                <Icon name="logout" size={14} /> Salir
            </button>

            <div style={{ textAlign: 'center', marginBottom: 20, pointerEvents: 'none' }}>
                <OmniaLogo variant="full" width={180} />
                <p style={{ margin: '10px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{nombreDisp} · {hora.toLocaleTimeString('es-PE')}</p>
            </div>

            {resultado ? (
                <div style={{ background: esEntrada ? 'rgba(34,197,94,0.15)' : 'rgba(249,115,22,0.15)', border: `2px solid ${esEntrada ? '#22c55e' : colors.orange}`, borderRadius: 24, padding: '40px 60px', textAlign: 'center', minWidth: 420 }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: esEntrada ? '#22c55e' : colors.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                        <Icon name="check" size={40} color="#fff" />
                    </div>
                    <p style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#fff' }}>{resultado.nombre}</p>
                    <p style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 700, color: esEntrada ? '#4ade80' : colors.orange, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {esEntrada ? 'Entrada registrada' : 'Salida registrada'}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>{resultado.hora}</p>
                </div>
            ) : (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <CamaraFacial ref={camaraRef} ancho={440} alto={330} />
                        <div style={{ position: 'absolute', inset: 0, border: `3px solid ${colors.orange}`, borderRadius: radius.lg, boxShadow: '0 0 30px rgba(249,115,22,0.4)', pointerEvents: 'none' }} />
                    </div>
                    <p style={{ margin: '20px 0 0', color: '#fff', fontSize: 18, fontWeight: 600 }}>Mira a la cámara para marcar</p>
                    <p style={{ margin: '6px 0 0', color: aviso ? '#FCA5A5' : 'rgba(255,255,255,0.5)', fontSize: 14, minHeight: 20 }}>
                        {aviso || 'Reconocimiento facial en tiempo real…'}
                    </p>
                </div>
            )}
        </Contenedor>
    );
}

function Contenedor({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', fontFamily: font, position: 'relative',
            background: `linear-gradient(135deg, #09090F 0%, #1A1C4B 55%, #1e2060 100%)`,
        }}>
            {children}
        </div>
    );
}
