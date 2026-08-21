// src/components/CardHero.jsx
// Evolucion de ScanReveal.jsx para personajes (decision del chat: "lo anterior del prototipo lo
// vamos evolucionando a su nueva iteracion") — mantiene el mismo beat de misterio (digitos
// girando -> se fijan -> flash) y despues, en vez de solo desvanecer a blanco, la carta cobra vida
// a pantalla completa: se mece (Nivel 0, sway.js) con luz y sombra reales (rendererCanvas2D.js).
// Se reabre mas adelante con la misma vista al tocar una carta ya escaneada (Codex) — pendiente,
// ver chat; por ahora esto cubre el momento "al recibir la carta".
import { useEffect, useRef, useState } from "react";
import Barcode from "./Barcode.jsx";
import { mountTitiritoreCard } from "../titiritero/index.js";
import { RAREZA_TIER } from "../core/pixelArt/palette.js";

const DIGIT_COUNT = 13;
const SPIN_MS = 750;
const LOCK_STEP_MS = 55;
const GAP_MS = 120;
const FLASH_MS = 160;

function randomDigit() {
  return String(Math.floor(Math.random() * 10));
}

export default function CardHero({ character, onFinish }) {
  const { code, nombre, rol, epiteto, clase, sexo, continente, rareza } = character;

  const [stage, setStage] = useState("spin"); // spin -> flash -> live
  const [digits, setDigits] = useState(() => code.split("").map(randomDigit));
  const [lockedCount, setLockedCount] = useState(0);
  const canvasRef = useRef(null);
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  };

  // Etapa 1: el mismo beat de decodificacion que ya existia (ScanReveal.jsx), sin tocarlo.
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDigits(code.split(""));
      setLockedCount(DIGIT_COUNT);
      setStage("live");
      return;
    }

    const timers = [];
    const spinInterval = setInterval(() => {
      setDigits((prev) => prev.map(() => randomDigit()));
    }, 55);

    for (let i = 0; i < DIGIT_COUNT; i++) {
      timers.push(
        setTimeout(() => {
          setDigits((prev) => {
            const next = [...prev];
            next[i] = code[i];
            return next;
          });
          setLockedCount(i + 1);
          if (i === DIGIT_COUNT - 1) clearInterval(spinInterval);
        }, SPIN_MS + i * LOCK_STEP_MS)
      );
    }

    const lockEnd = SPIN_MS + DIGIT_COUNT * LOCK_STEP_MS;
    const flashAt = lockEnd + GAP_MS;
    const liveAt = flashAt + FLASH_MS;

    timers.push(setTimeout(() => setStage("flash"), flashAt));
    timers.push(setTimeout(() => setStage("live"), liveAt));

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(spinInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Etapa 2: la carta viva — se monta el motor Titiritero recien cuando entramos a "live", y se
  // desmonta (cancela el rAF) si el componente se va antes de que el jugador la cierre.
  useEffect(() => {
    if (stage !== "live" || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const cleanup = mountTitiritoreCard(canvas, character);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  return (
    <div className={`card-hero card-hero--${stage}`} onClick={stage === "live" ? finish : undefined} role="presentation">
      {stage !== "live" && (
        <div className="card-hero-decode">
          <div className="scan-reveal-barcode">
            <Barcode code={code} className="scan-reveal-barcode-svg" />
            <div className="scan-reveal-scanbeam" />
          </div>
          <div className="scan-reveal-digits">
            {digits.map((d, i) => (
              <span key={i} className={`scan-reveal-digit${i < lockedCount ? " scan-reveal-digit--locked" : ""}`}>
                {d}
              </span>
            ))}
          </div>
          <div className="scan-reveal-hint">Decodificando…</div>
          {stage === "flash" && <div className="card-hero-flashpulse" />}
        </div>
      )}

      {stage === "live" && (
        <>
          <canvas ref={canvasRef} className="card-hero-canvas" />
          <div className={`card-hero-panel rareza-panel--${RAREZA_TIER[rareza]}`}>
            <div className="card-hero-rareza">{rareza}</div>
            <h2 className="card-hero-name">{nombre}</h2>
            <div className="card-hero-epithet">{rol} {epiteto}</div>
            <div className="card-hero-sub">{clase} · {sexo} · {continente}</div>
            <div className="card-hero-tap-hint">Tocá para continuar</div>
          </div>
        </>
      )}
    </div>
  );
}
