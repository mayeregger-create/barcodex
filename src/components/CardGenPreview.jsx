// src/components/CardGenPreview.jsx
// Pantalla de PRUEBA (beta, accesible solo desde un link secundario en el titulo) para el sistema
// nuevo: escribis un codigo, generateCard() (cardgen/card.js) lo resuelve, y Titiritero lo dibuja
// en vivo. No es una pantalla real del juego todavia — no hay Scan/Codex/Combate para este
// sistema, esto solo prueba que el generador y el motor visual quedaron bien conectados.
import { useEffect, useRef, useState } from "react";
import { generateCard } from "../cardgen/card.js";
import { mountTitiritoreCardFromGenerated } from "../titiritero/index.js";

function randomCode13() {
  let d = "";
  for (let i = 0; i < 13; i++) d += Math.floor(Math.random() * 10);
  return d;
}

export default function CardGenPreview({ onBack }) {
  const [code, setCode] = useState("7840123456789");
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const cleanupRef = useRef(null);

  const generate = (rawCode) => {
    try {
      const generated = generateCard(rawCode);
      setError(null);
      setCard(generated);
    } catch (err) {
      setError(err.message);
      setCard(null);
    }
  };

  useEffect(() => {
    if (!card || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    cleanupRef.current = mountTitiritoreCardFromGenerated(canvas, card);
    return () => cleanupRef.current?.();
  }, [card]);

  const handleRandom = () => {
    const next = randomCode13();
    setCode(next);
    generate(next);
  };

  return (
    <div className="cardgen-preview">
      <div className="cardgen-preview-controls">
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 13))}
          placeholder="Código de barras (12-13 dígitos)"
          className="cardgen-preview-input"
        />
        <button type="button" className="scan-again cardgen-preview-btn" onClick={() => generate(code)}>
          Generar
        </button>
        <button type="button" className="scan-again scan-again--secondary cardgen-preview-btn" onClick={handleRandom}>
          🎲
        </button>
      </div>

      {error && <p className="cardgen-preview-error">{error}</p>}

      <div className="cardgen-preview-canvas-wrap">
        {card ? (
          <canvas ref={canvasRef} className="cardgen-preview-canvas" />
        ) : (
          <p className="cardgen-preview-hint">Ingresá un código y tocá Generar (o 🎲 para uno al azar).</p>
        )}
      </div>

      {card && (
        <div className="cardgen-preview-debug pixel-scroll">
          <div>
            {card.identity.displayName} — {card.lineage} · {card.identity.class} · {card.rarity} · Coste {card.cost}
          </div>
          <div>
            Fuerza {card.combat.strength} · Iniciativa {card.combat.initiative} · Peso {card.combat.weight} ·{" "}
            {card.combat.damageTypeActive}
          </div>
          <div>
            Rasgo: {card.identity.trait}
            {card.identity.secondTrait ? ` + ${card.identity.secondTrait}` : ""} ({card.generation.traitTier})
          </div>
        </div>
      )}

      <button type="button" className="scan-again scan-again--secondary cardgen-preview-back" onClick={onBack}>
        Volver
      </button>
    </div>
  );
}
