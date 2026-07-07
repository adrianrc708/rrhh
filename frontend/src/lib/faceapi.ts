// ============================================================================
// Fase 3 — Cargador de face-api.js desde CDN (sin dependencia npm ni pesos locales).
//
// La detección facial y el descriptor de 128 dimensiones se calculan EN EL CLIENTE.
// El backend solo recibe el descriptor y hace el matching. Requiere internet en la
// tablet (natural en un kiosco web).
// ============================================================================

const SCRIPT_CDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const MODELOS_CDN = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

let scriptPromise: Promise<void> | null = null;
let modelosCargados = false;

function inyectarScript(): Promise<void> {
    if ((window as any).faceapi) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SCRIPT_CDN;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('No se pudo cargar face-api.js desde el CDN. Verifica la conexión.'));
        document.head.appendChild(s);
    });
    return scriptPromise;
}

/** Carga la librería y los modelos (idempotente). Devuelve el objeto faceapi global. */
export async function cargarFaceApi(): Promise<any> {
    await inyectarScript();
    const faceapi = (window as any).faceapi;
    if (!faceapi) throw new Error('face-api.js no está disponible.');
    if (!modelosCargados) {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODELOS_CDN);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODELOS_CDN);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODELOS_CDN);
        modelosCargados = true;
    }
    return faceapi;
}

/**
 * Calcula el descriptor facial (128 floats) a partir de un elemento <video> o
 * <canvas>/<img>. Devuelve null si no se detecta un rostro.
 */
export async function obtenerDescriptor(fuente: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<number[] | null> {
    const faceapi = await cargarFaceApi();
    const deteccion = await faceapi
        .detectSingleFace(fuente, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
    if (!deteccion) return null;
    return Array.from(deteccion.descriptor as Float32Array);
}
