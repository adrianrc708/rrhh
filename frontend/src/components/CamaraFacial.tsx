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
        (async () => {
            try {
                await cargarFaceApi(); // precarga modelos mientras se abre la cámara
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    setListo(true);
                }
            } catch (e: any) {
                setError(e?.message || 'No se pudo acceder a la cámara. Concede permisos.');
            }
        })();
        return () => { stream?.getTracks().forEach((t) => t.stop()); };
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
