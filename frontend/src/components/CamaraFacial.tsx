import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { colors, radius } from '../theme';
import { obtenerDescriptor, cargarFaceApi, hayRostro } from '../lib/faceapi';

const INTERVALO_DETECCION_VIVO = 400;

// Cámara web reutilizable (kiosco y enrolamiento). Expone `capturarDescriptor`
// de forma imperativa vía ref.
export interface CamaraHandle {
    capturarDescriptor: () => Promise<number[] | null>;
    listo: boolean;
    rostroDetectado: boolean;
}

interface Props {
    ancho?: number;
    alto?: number;
    espejo?: boolean;
}

const CamaraFacial = forwardRef<CamaraHandle, Props>(({ ancho = 360, alto = 270, espejo = true }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState('');
    const [listo, setListo] = useState(false);
    const [rostroDetectado, setRostroDetectado] = useState(false);

    useEffect(() => {
        let stream: MediaStream | null = null;
        let cancelado = false;
        (async () => {
            // 1) Modelos de face-api (CDN). Si fallan, es un problema distinto al de la cámara.
            try {
                await cargarFaceApi();
            } catch (e: any) {
                if (!cancelado) setError(e?.message || 'No se pudieron cargar los modelos de reconocimiento facial. Revisa la conexión a internet.');
                return;
            }

            // 2) Contexto seguro: getUserMedia solo existe en HTTPS o en localhost.
            //    En una tablet accedida por IP de red (http://192.168.x.x) NO está disponible.
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                if (!cancelado) setError(
                    'La cámara requiere una conexión segura. Abre el kiosco en "localhost" o sirve la app por HTTPS (la tablet no puede usar la cámara por http://IP).'
                );
                return;
            }

            // 3) Apertura de la cámara. Se prueba la cámara frontal y, si el equipo no la
            //    soporta como restricción, se reintenta con cualquier cámara disponible.
            try {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                } catch {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true });
                }
                if (videoRef.current && !cancelado) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    setListo(true);
                }
            } catch (e: any) {
                const nombre = e?.name || '';
                const msg = nombre === 'NotAllowedError'
                    ? 'Permiso de cámara denegado. Habilítalo en el navegador para poder marcar.'
                    : nombre === 'NotFoundError'
                        ? 'No se detectó ninguna cámara en este dispositivo.'
                        : (e?.message || 'No se pudo acceder a la cámara.');
                if (!cancelado) setError(msg);
            }
        })();
        return () => { cancelado = true; stream?.getTracks().forEach((t) => t.stop()); };
    }, []);

    // Feedback en vivo: detector liviano en loop para que el usuario sepa, en tiempo
    // real, si la cámara lo está viendo — en vez de enterarse recién al capturar.
    useEffect(() => {
        if (!listo) { setRostroDetectado(false); return; }
        let cancelado = false;
        let ocupado = false;
        const id = setInterval(async () => {
            if (ocupado || cancelado || !videoRef.current) return;
            ocupado = true;
            try {
                const detectado = await hayRostro(videoRef.current);
                if (!cancelado) setRostroDetectado(detectado);
            } catch {
                /* si falla la detección liviana, no interrumpe la captura real */
            } finally { ocupado = false; }
        }, INTERVALO_DETECCION_VIVO);
        return () => { cancelado = true; clearInterval(id); };
    }, [listo]);

    useImperativeHandle(ref, () => ({
        listo,
        rostroDetectado,
        capturarDescriptor: async () => {
            if (!videoRef.current || !listo) return null;
            return obtenerDescriptor(videoRef.current);
        },
    }), [listo, rostroDetectado]);

    return (
        <div style={{ position: 'relative', width: ancho }}>
            <video
                ref={videoRef}
                width={ancho}
                height={alto}
                muted
                playsInline
                style={{
                    width: ancho, height: alto, objectFit: 'cover', borderRadius: radius.lg,
                    background: '#0b0d1c', transform: espejo ? 'scaleX(-1)' : 'none',
                    border: `2px solid ${listo && rostroDetectado ? '#22c55e' : colors.border}`,
                    transition: 'border-color .15s',
                }}
            />
            {!listo && !error && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>
                    Iniciando cámara…
                </div>
            )}
            {listo && !error && (
                <div style={{
                    position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
                    background: rostroDetectado ? 'rgba(34,197,94,0.85)' : 'rgba(0,0,0,0.55)',
                    color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: rostroDetectado ? '#fff' : '#FCA5A5' }} />
                    {rostroDetectado ? 'Rostro detectado' : 'Buscando rostro… acércate y mira a la cámara'}
                </div>
            )}
            {error && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FCA5A5', fontSize: 13, textAlign: 'center', padding: 16 }}>
                    {error}
                </div>
            )}
        </div>
    );
});

export default CamaraFacial;
