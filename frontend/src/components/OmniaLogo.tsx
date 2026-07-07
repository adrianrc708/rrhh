import React, { useRef, useEffect } from 'react';

function quitarFondo(canvas: HTMLCanvasElement, threshold = 60) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = ctx.getImageData(1, 1, 1, 1).data;
    const [br, bg, bb] = [s[0], s[1], s[2]];
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const dist = Math.sqrt((d[i]-br)**2 + (d[i+1]-bg)**2 + (d[i+2]-bb)**2);
        if (dist < threshold) d[i+3] = Math.round((dist / threshold) * 60);
    }
    ctx.putImageData(img, 0, 0);
}

interface OmniaLogoProps {
    variant?: 'full' | 'compact';
    width?: number;   // px fijos — por defecto: full=240, compact=160
    // El PNG fuente trae el texto en blanco sobre fondo navy: quitar el fondo (chroma-key)
    // solo tiene sentido sobre superficies oscuras. Sobre una tarjeta clara/blanca, el
    // texto blanco quedaría invisible — en ese caso se deja el navy de fondo como una
    // placa con esquinas redondeadas en vez de intentar hacerlo transparente.
    sobreClaro?: boolean;
}

export function OmniaLogo({ variant = 'compact', width, sobreClaro = false }: OmniaLogoProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const image = new Image();
        image.onload = () => {
            canvas.width  = image.naturalWidth;
            canvas.height = image.naturalHeight;
            canvas.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(image, 0, 0);
            if (!sobreClaro) quitarFondo(canvas);
        };
        image.src = '/omnia-logo.png';
    }, [sobreClaro]);

    const w = width ?? (variant === 'full' ? 240 : 160);

    return (
        <canvas
            ref={canvasRef}
            style={{
                // margin: '0 auto' — al ser un <canvas> (display: block), un padre con
                // textAlign: 'center' no lo centra (eso solo afecta inline/inline-block).
                // Con margin auto queda centrado también en esos contextos, sin romper
                // los que ya lo centran por flexbox.
                width: w, height: 'auto', display: 'block', margin: '0 auto', userSelect: 'none',
                borderRadius: sobreClaro ? 14 : 0,
            }}
        />
    );
}
