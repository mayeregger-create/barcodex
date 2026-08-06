// src/components/ScanReveal.jsx
// Puente dramático entre "se detectó un código" y "acá está tu personaje": se monta como overlay
// A PANTALLA COMPLETA por encima de la pantalla de resultado, que ya está montada y lista debajo
// (ver App.jsx) — así el fade-to-white final no revela nada a medio construir, solo se despega
// del contenido real que ya estaba ahí. Etapas: dígitos girando al azar (misterio) -> se van
// fijando de izquierda a derecha -> flash -> blanco total -> se despega y queda "fijada" la ficha.
import { useEffect, useRef, useState } from "react";
import Barcode from "./Barcode.jsx";

const DIGIT_COUNT = 13;
const SPIN_MS = 750;
const LOCK_STEP_MS = 55;
const GAP_MS = 120;
const FLASH_MS = 160;
const WHITEOUT_MS = 350;
const HOLD_WHITE_MS = 180;
const CLEAR_MS = 450;

function randomDigit() {
  return String(Math.floor(Math.random() * 10));
}

export default function ScanReveal({ code, onFinish }) {
  const [stage, setStage] = useState("spin"); // spin -> flash -> whiteout -> clear
  const [digits, setDigits] = useState(() => code.split("").map(randomDigit));
  const [lockedCount, setLockedCount] = useState(0);
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  };

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDigits(code.split(""));
      setLockedCount(DIGIT_COUNT);
      const t = setTimeout(finish, 200);
      return () => clearTimeout(t);
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
    const whiteoutAt = flashAt + FLASH_MS;
    const clearAt = whiteoutAt + WHITEOUT_MS + HOLD_WHITE_MS;
    const finishAt = clearAt + CLEAR_MS;

    timers.push(setTimeout(() => setStage("flash"), flashAt));
    timers.push(setTimeout(() => setStage("whiteout"), whiteoutAt));
    timers.push(setTimeout(() => setStage("clear"), clearAt));
    timers.push(setTimeout(finish, finishAt));

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(spinInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div
      className={`scan-reveal scan-reveal--${stage}`}
      style={{ "--flash-ms": `${FLASH_MS}ms`, "--whiteout-ms": `${WHITEOUT_MS}ms`, "--clear-ms": `${CLEAR_MS}ms` }}
      onClick={finish}
      role="presentation"
    >
      <div className="scan-reveal-barcode">
        <Barcode code={code} className="scan-reveal-barcode-svg" />
        <div className="scan-reveal-scanbeam" />
        <div className="scan-reveal-groups">
          <span className="scan-reveal-group scan-reveal-group--0" />
          <span className="scan-reveal-group scan-reveal-group--1" />
          <span className="scan-reveal-group scan-reveal-group--2" />
          <span className="scan-reveal-group scan-reveal-group--3" />
        </div>
      </div>

      <div className="scan-reveal-digits">
        {digits.map((d, i) => (
          <span
            key={i}
            className={`scan-reveal-digit${i < lockedCount ? " scan-reveal-digit--locked" : ""}`}
          >
            {d}
          </span>
        ))}
      </div>

      <div className="scan-reveal-hint">Decodificando…</div>
      <div className="scan-reveal-flashpulse" />
    </div>
  );
}
