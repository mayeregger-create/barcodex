// src/components/CombatFirstRunTutorial.jsx
// Recorrido de 4 pasos que aparece SOLO la primera vez que el jugador entra a un combate (ver
// onboarding.js#hasSeenCombatTutorial) — CombatScreen.jsx pausa el autobattle mientras esto esta
// activo (nadie quiere leer una explicación mientras el combate sigue de largo). Cada paso mide
// la posicion real de un elemento ya en pantalla y dibuja un marco alrededor + un cartel con la
// explicación, en vez de ser un modal generico que no señala nada concreto.
import { useEffect, useState } from "react";

const STEPS = [
  {
    selector: ".combat-slot--active",
    text: "Este es el turno de tu personaje activo. El combate corre solo — no hace falta que toques nada.",
  },
  {
    selector: ".combat-hp-bar",
    text: "La barra de vida: si llega a 0, ese personaje cae y entra el siguiente de tu equipo.",
  },
  {
    selector: ".combat-log",
    text: "Acá vas viendo, línea por línea, cada golpe, bloqueo y habilidad que va pasando.",
  },
  {
    selector: ".combat-speed-btn",
    text: "¿Se hace largo? Tocá acá para acelerar el combate a ×2.",
  },
];

export default function CombatFirstRunTutorial({ onDone }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const el = document.querySelector(STEPS[step].selector);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  const isLast = step + 1 >= STEPS.length;
  const next = () => (isLast ? onDone() : setStep((s) => s + 1));

  const captionBelow = !rect || rect.top < window.innerHeight * 0.55;

  return (
    <div className="combat-tutorial-backdrop">
      {rect && (
        <div
          className="combat-tutorial-ring"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}

      <div
        className="combat-tutorial-caption"
        style={captionBelow ? { top: (rect ? rect.bottom : 20) + 10 } : { bottom: window.innerHeight - (rect ? rect.top : window.innerHeight - 20) + 10 }}
      >
        <p>{STEPS[step].text}</p>
        <div className="combat-tutorial-actions">
          <button type="button" className="combat-tutorial-skip" onClick={onDone}>Saltar</button>
          <div className="combat-tutorial-dots">
            {STEPS.map((_, i) => (
              <span key={i} className={`combat-tutorial-dot${i === step ? " combat-tutorial-dot--active" : ""}`} />
            ))}
          </div>
          <button type="button" className="combat-tutorial-next" onClick={next}>
            {isLast ? "Entendido" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
