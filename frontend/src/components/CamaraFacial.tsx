import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { colors, radius } from '../theme';
import { obtenerDescriptor, cargarFaceApi } from '../lib/faceapi';

// Cámara web reutilizable (kiosco y enrolamiento). Expone `capturarDescriptor`
// de forma imperativa vía ref.
export interface CamaraHandle {
    capturarDescriptor: () => Promise<number[] | null>;
    listo: boolean;
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

    useImperativeHandle(ref, () => ({
        listo,
        capturarDescriptor: async () => {
            if (!videoRef.current || !listo) return null;
            return obtenerDescriptor(videoRef.current);
        },
    }), [listo]);

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
                    border: `2px solid ${colors.border}`,
                }}
            />
            {!listo && !error && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>
                    Iniciando cámara…
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
