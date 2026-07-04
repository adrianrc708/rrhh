import React, { useEffect, useState } from 'react';
import { colors, font } from '../theme';
import Icon from './Icons';

export interface DatosPago {
    plan: string;
    numEmpleados: number;
    metodoPago: 'Tarjeta' | 'Yape' | 'Transferencia';
    tarjetaUltimos4?: string;
}

export interface ResultadoPago {
    usuario: { nombre: string; rol: string; correo: string };
    pago: { plan: string; numEmpleados: number; monto: number; referencia: string; estado: string };
}

interface PasarelaPagoProps {
    empresaNombre: string;
    onBack: () => void;
    onPagar: (datos: DatosPago) => Promise<ResultadoPago>;
    onDone: (usuario: { nombre: string; rol: string; correo: string }) => void;
}

const orange = colors.orange;

// Debe coincidir exactamente con la calculadora de precios de la landing page.
// Corporativo no tiene tope superior: cualquier empresa, sin importar el tamaño, cabe en este plan.
const MAX_EMPLEADOS = 9999; // límite práctico solo para evitar valores absurdos, no una restricción real de negocio
const PLANES = [
    { nombre: 'Micro', min: 1, max: 15, precio: 12 },
    { nombre: 'Estándar', min: 16, max: 100, precio: 10 },
    { nombre: 'Corporativo', min: 101, max: Infinity, precio: 8 },
];

function esperar(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function CampoTarjeta({ label, value, onChange, placeholder, maxLength }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: colors.textBody }}>{label}</label>
            <input
                value={value} placeholder={placeholder} maxLength={maxLength} inputMode="numeric"
                onChange={e => onChange(e.target.value)}
                style={{
                    padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${colors.border}`,
                    fontSize: 14.5, fontFamily: font, outline: 'none', color: colors.textBody,
                    background: '#fff', transition: 'border-color .15s', width: '100%', boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = orange)}
                onBlur={e => (e.target.style.borderColor = colors.border)}
            />
        </div>
    );
}

function FilaResumen({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: colors.textMuted }}>{label}</span>
            <span style={{ color: colors.textStrong, fontWeight: strong ? 700 : 500 }}>{value}</span>
        </div>
    );
}

// Solo decorativo (no es un QR escaneable): reproduce los 3 patrones localizadores
// de esquina y el patrón de alineación característicos de un QR real, con relleno
// pseudoaleatorio determinístico en el resto de módulos.
const QR_MODULOS = 21;

function moduloQR(x: number, y: number): boolean {
    const finders: [number, number][] = [[0, 0], [QR_MODULOS - 7, 0], [0, QR_MODULOS - 7]];
    for (const [fx, fy] of finders) {
        if (x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7) {
            const lx = x - fx, ly = y - fy;
            if (lx < 0 || lx > 6 || ly < 0 || ly > 6) return false; // separador blanco
            const enBorde = lx === 0 || lx === 6 || ly === 0 || ly === 6;
            const enCentro = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
            return enBorde || enCentro;
        }
    }
    const ax = QR_MODULOS - 9, ay = QR_MODULOS - 9;
    if (x >= ax && x <= ax + 4 && y >= ay && y <= ay + 4) {
        const lx = x - ax, ly = y - ay;
        return lx === 0 || lx === 4 || ly === 0 || ly === 4 || (lx === 2 && ly === 2);
    }
    const hash = (x * 928371 + y * 123457 + x * y * 71) % 7;
    return hash < 3;
}

function FakeQR({ size = 148 }: { size?: number }) {
    const cell = size / QR_MODULOS;
    const modulos: React.ReactNode[] = [];
    for (let y = 0; y < QR_MODULOS; y++) {
        for (let x = 0; x < QR_MODULOS; x++) {
            if (moduloQR(x, y)) {
                modulos.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} />);
            }
        }
    }
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{
            background: '#fff', padding: 14, borderRadius: 12,
            border: `1px solid ${colors.border}`, boxSizing: 'content-box', display: 'block', margin: '0 auto',
        }}>
            <g fill={colors.navy900}>{modulos}</g>
        </svg>
    );
}

export default function PasarelaPago({ empresaNombre, onBack, onPagar, onDone }: PasarelaPagoProps) {
    const [numEmpleados, setNumEmpleados] = useState(10);
    const [metodo, setMetodo] = useState<'Tarjeta' | 'Yape' | 'Transferencia'>('Tarjeta');

    const [numero, setNumero] = useState('');
    const [venc, setVenc] = useState('');
    const [cvc, setCvc] = useState('');
    const [nombreTarjeta, setNombreTarjeta] = useState('');

    const [view, setView] = useState<'form' | 'processing' | 'success'>('form');
    const [localError, setLocalError] = useState('');
    const [resultado, setResultado] = useState<ResultadoPago | null>(null);

    const [segundosQR, setSegundosQR] = useState(299);

    const plan = PLANES.find(p => numEmpleados >= p.min && numEmpleados <= p.max) ?? PLANES[2];
    const monto = plan.precio * numEmpleados;

    useEffect(() => {
        if (metodo !== 'Yape' || view !== 'form') return;
        setSegundosQR(299);
        const id = setInterval(() => setSegundosQR(s => (s > 0 ? s - 1 : 0)), 1000);
        return () => clearInterval(id);
    }, [metodo, view]);

    const mmss = `${String(Math.floor(segundosQR / 60)).padStart(2, '0')}:${String(segundosQR % 60).padStart(2, '0')}`;

    const handleNumero = (raw: string) => {
        const digits = raw.replace(/\D/g, '').slice(0, 16);
        setNumero(digits.match(/.{1,4}/g)?.join(' ') || digits);
    };

    const handleVenc = (raw: string) => {
        let digits = raw.replace(/\D/g, '').slice(0, 4);
        if (digits.length >= 2) digits = digits.slice(0, 2) + ' / ' + digits.slice(2);
        setVenc(digits);
    };

    const handleSubmit = async () => {
        setLocalError('');
        if (metodo === 'Tarjeta') {
            const digits = numero.replace(/\D/g, '');
            if (digits.length !== 16) { setLocalError('Ingresa un número de tarjeta válido de 16 dígitos.'); return; }
            if (!/^\d{2} \/ \d{2}$/.test(venc)) { setLocalError('Ingresa la fecha de vencimiento en formato MM / AA.'); return; }
            if (cvc.length !== 3) { setLocalError('El CVC debe tener 3 dígitos.'); return; }
            if (!nombreTarjeta.trim()) { setLocalError('Ingresa el nombre que figura en la tarjeta.'); return; }
        }

        setView('processing');
        try {
            const tarjetaUltimos4 = metodo === 'Tarjeta' ? numero.replace(/\D/g, '').slice(-4) : undefined;
            const [res] = await Promise.all([
                onPagar({ plan: plan.nombre, numEmpleados, metodoPago: metodo, tarjetaUltimos4 }),
                esperar(1100),
            ]);
            setResultado(res);
            setView('success');
            setTimeout(() => onDone(res.usuario), 1700);
        } catch (err: any) {
            setLocalError(err.message || 'No se pudo procesar el pago. Inténtalo de nuevo.');
            setView('form');
        }
    };

    return (
        <div>
            <style>{`
                @keyframes pago-spin { to { transform: rotate(360deg); } }
                @keyframes pago-pop { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>

            {view === 'processing' && (
                <div style={{ textAlign: 'center', padding: '64px 20px' }}>
                    <div style={{
                        width: 40, height: 40, margin: '0 auto 20px', borderRadius: '50%',
                        border: `3px solid ${colors.border}`, borderTopColor: orange,
                        animation: 'pago-spin 0.8s linear infinite',
                    }} />
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.textStrong }}>Procesando tu pago…</p>
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: colors.textFaint }}>No cierres esta ventana</p>
                </div>
            )}

            {view === 'success' && resultado && (
                <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{
                        width: 60, height: 60, borderRadius: '50%', background: colors.greenSoft,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 18px', animation: 'pago-pop 0.35s ease',
                    }}>
                        <Icon name="check" size={30} color={colors.green} />
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: colors.textStrong }}>¡Pago exitoso!</p>
                    <p style={{ margin: '0 0 4px', fontSize: 14, color: colors.textBody }}>
                        Tu suscripción al <strong>Plan {resultado.pago.plan}</strong> está activa.
                    </p>
                    <p style={{ margin: 0, fontSize: 12.5, color: colors.textFaint }}>Referencia {resultado.pago.referencia}</p>
                </div>
            )}

            {view === 'form' && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <button type="button" onClick={onBack} style={{
                            background: 'none', border: 'none', cursor: 'pointer', fontFamily: font,
                            fontSize: 13, fontWeight: 600, color: colors.textMuted, padding: 0,
                        }}>
                            ← Volver a mis datos
                        </button>
                        <span style={{ fontSize: 11, fontWeight: 700, color: colors.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            Paso 2 de 2
                        </span>
                    </div>

                    <p style={{ margin: '0 0 20px', fontSize: 14, color: colors.textMuted }}>
                        Elige tu plan para <strong style={{ color: colors.textStrong }}>{empresaNombre || 'tu empresa'}</strong>
                    </p>

                    <div style={{ marginBottom: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                            <label style={{ fontSize: 13.5, fontWeight: 600, color: colors.textBody }}>Número de empleados</label>
                            <input
                                type="number" min={1} max={MAX_EMPLEADOS} value={numEmpleados}
                                onChange={e => {
                                    const v = Math.round(Number(e.target.value));
                                    setNumEmpleados(Number.isFinite(v) && v > 0 ? Math.min(v, MAX_EMPLEADOS) : 1);
                                }}
                                style={{
                                    fontSize: 22, fontWeight: 800, color: orange, background: 'transparent',
                                    border: 'none', outline: 'none', textAlign: 'right', width: 80, fontFamily: font,
                                }}
                            />
                        </div>
                        <input
                            type="range" min={1} max={500} value={Math.min(numEmpleados, 500)}
                            onChange={e => setNumEmpleados(Number(e.target.value))}
                            style={{ width: '100%', accentColor: orange, cursor: 'pointer' }}
                        />
                        <p style={{ margin: '6px 0 0', fontSize: 11, color: colors.textFaint, textAlign: 'right' }}>
                            ¿Más de 500? Escribe el número exacto arriba — no hay límite.
                        </p>
                    </div>

                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, background: colors.orangeSoft,
                        border: `1px solid ${orange}55`, borderRadius: 999, padding: '6px 16px', marginBottom: 16,
                    }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: orange }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: colors.orangeText }}>Plan {plan.nombre} · S/ {plan.precio}/usuario</span>
                    </div>

                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: colors.bg, borderRadius: 12, padding: '14px 18px', marginBottom: 20,
                    }}>
                        <span style={{ fontSize: 13, color: colors.textMuted }}>Total mensual · {numEmpleados} empleado{numEmpleados === 1 ? '' : 's'}</span>
                        <span style={{ fontSize: 21, fontWeight: 800, color: colors.textStrong }}>S/ {monto.toLocaleString('es-PE')}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                        {(['Tarjeta', 'Yape', 'Transferencia'] as const).map(m => (
                            <button key={m} type="button" onClick={() => setMetodo(m)} style={{
                                flex: 1, padding: '9px 4px', borderRadius: 8, cursor: 'pointer', fontFamily: font,
                                border: metodo === m ? `1.5px solid ${orange}` : `1.5px solid ${colors.border}`,
                                background: metodo === m ? colors.orangeSoft : '#fff',
                                color: metodo === m ? colors.orangeText : colors.textMuted,
                                fontWeight: 600, fontSize: 12.5,
                            }}>
                                {m}
                            </button>
                        ))}
                    </div>

                    {localError && (
                        <div style={{ background: colors.redSoft, color: colors.redText, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500 }}>
                            {localError}
                        </div>
                    )}

                    {metodo === 'Tarjeta' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <CampoTarjeta label="Número de tarjeta" value={numero} onChange={handleNumero} placeholder="4242 4242 4242 4242" maxLength={19} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <CampoTarjeta label="Vencimiento" value={venc} onChange={handleVenc} placeholder="MM / AA" maxLength={7} />
                                <CampoTarjeta label="CVC" value={cvc} onChange={v => setCvc(v.replace(/\D/g, '').slice(0, 3))} placeholder="123" maxLength={3} />
                            </div>
                            <CampoTarjeta label="Nombre en la tarjeta" value={nombreTarjeta} onChange={setNombreTarjeta} placeholder="JUAN PEREZ" />
                        </div>
                    )}

                    {metodo === 'Yape' && (
                        <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
                            <FakeQR />
                            <p style={{ margin: '16px 0 0', fontSize: 13, color: colors.textBody }}>
                                Escanea con Yape o Plin para pagar <strong>S/ {monto.toLocaleString('es-PE')}</strong>
                            </p>
                            <p style={{ margin: '6px 0 0', fontSize: 12, color: colors.textFaint }}>El código expira en {mmss}</p>
                        </div>
                    )}

                    {metodo === 'Transferencia' && (
                        <div>
                            <div style={{ background: colors.bg, borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
                                <FilaResumen label="Banco" value="BCP" />
                                <FilaResumen label="Cuenta corriente" value="193-2384756-0-89" />
                                <FilaResumen label="CCI" value="002-193-002384756089-10" />
                                <FilaResumen label="Monto exacto" value={`S/ ${monto.toLocaleString('es-PE')}`} strong />
                            </div>
                            <p style={{ margin: '12px 0 0', fontSize: 12, color: colors.textFaint, lineHeight: 1.6 }}>
                                Al confirmar, tu pago se validará de forma automática y tu cuenta se activará al instante.
                            </p>
                        </div>
                    )}

                    <button onClick={handleSubmit} style={{
                        marginTop: 22, padding: '15px', width: '100%', background: orange, color: '#fff',
                        border: 'none', borderRadius: 12, fontSize: 15.5, fontWeight: 700, cursor: 'pointer',
                        fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                        <Icon name="shield" size={17} />
                        Pagar S/ {monto.toLocaleString('es-PE')} y crear mi cuenta
                    </button>

                    <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 11.5, color: colors.textFaint }}>
                        Pago seguro y encriptado
                    </p>
                </div>
            )}
        </div>
    );
}
