import React, { useEffect } from 'react';

interface Props { onFinish: () => void; }

export default function IntroAnimation({ onFinish }: Props) {
    useEffect(() => {
        const t = setTimeout(onFinish, 5600);
        const onKey = () => onFinish();
        window.addEventListener('keydown', onKey);
        return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
    }, [onFinish]);

    const r = 62, sw = 13, cx = 80, cy = 80;
    const circ = 2 * Math.PI * r;   // circunferencia total ≈ 389.56
    const gap  = circ * (16 / 360); // hueco 16° ≈ 17.3 unidades

    // Animación: dibuja el arco desde abajo en sentido horario hasta completar el círculo.
    // stroke-dasharray circ/circ + dashoffset circ→gap hace exactamente eso,
    // y rotate(98) coloca el inicio/fin del trazo en la parte inferior (6 en punto).

    return (
        <div onClick={onFinish} style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#09090F', cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Inter', sans-serif",
        }}>
            <style>{`
                @keyframes ring-draw {
                    from { stroke-dashoffset: ${circ.toFixed(2)}; opacity: 0; }
                    6%   { opacity: 1; }
                    to   { stroke-dashoffset: ${gap.toFixed(2)}; }
                }
                @keyframes ring-glow {
                    0%,100% { filter: drop-shadow(0 0 0px #F97316); }
                    50%     { filter: drop-shadow(0 0 20px #F97316bb); }
                }
                @keyframes title-rise {
                    from { opacity: 0; transform: translateY(24px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes sub-fade {
                    from { opacity: 0; letter-spacing: 0.3em; }
                    to   { opacity: 0.45; letter-spacing: 0.16em; }
                }
                @keyframes line-grow { to { width: 160px; } }
                @keyframes outro {
                    0%   { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(1.06); }
                }
                .intro-container {
                    display: flex; flex-direction: column; align-items: center; gap: 20px;
                    animation: outro 0.9s ease-in 4.7s forwards;
                }
                .intro-ring {
                    animation: ring-draw 2.2s cubic-bezier(.35,0,.1,1) 0.3s both,
                               ring-glow 2s ease-in-out 2.5s infinite;
                }
                .intro-title {
                    font-family: 'Orbitron', 'Inter', sans-serif;
                    font-size: 56px; font-weight: 900;
                    letter-spacing: 0.18em; color: #fff;
                    animation: title-rise 0.9s cubic-bezier(.2,0,.1,1) 2s both;
                }
                .intro-o { color: #F97316; }
                .intro-sub {
                    font-size: 13px; color: #fff; text-transform: uppercase;
                    font-weight: 600;
                    animation: sub-fade 1s ease 2.9s both;
                }
                .intro-line {
                    width: 0; height: 1px; background: #F97316;
                    animation: line-grow 0.8s ease 2.6s forwards;
                }
            `}</style>

            <div className="intro-container">
                <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
                    <circle
                        className="intro-ring"
                        cx={cx} cy={cy} r={r}
                        stroke="#F97316" strokeWidth={sw}
                        strokeLinecap="round"
                        strokeDasharray={`${circ.toFixed(2)} ${circ.toFixed(2)}`}
                        strokeDashoffset={gap.toFixed(2)}
                        transform={`rotate(98 ${cx} ${cy})`}
                    />
                </svg>

                <div className="intro-line" />

                <div className="intro-title">
                    <span className="intro-o">O</span>MNIA
                </div>

                <div className="intro-sub">Gestión centralizada de RR.HH.</div>
            </div>

            <p style={{ position: 'absolute', bottom: 32, fontSize: 12, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em', fontFamily: "'Inter', sans-serif" }}>
                Haz clic o presiona cualquier tecla para continuar
            </p>
        </div>
    );
}
