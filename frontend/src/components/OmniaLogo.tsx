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
}

export function OmniaLogo({ variant = 'compact', width }: OmniaLogoProps) {
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
            quitarFondo(canvas);
        };
        image.src = '/omnia-logo.png';
    }, []);

    const w = width ?? (variant === 'full' ? 240 : 160);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: w, height: 'auto', display: 'block', userSelect: 'none' }}
        />
    );
}
