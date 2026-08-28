// src/components/TitleScreen.jsx
// Pantalla de titulo, a pantalla completa (sin header ni bottom nav — ver App.jsx). El fondo
// (.title-art) apunta a /title-bg.jpg: mientras no exista ese archivo se ve el degrade de
// respaldo definido en CSS, asi nunca se ve "roto".
//
// Arranca en un "portal" de un solo toque en vez de mostrar el logo/boton de una: los
// navegadores bloquean audio hasta el primer gesto del usuario, asi que ESE primer toque es la
// unica oportunidad real de que "Moss Gate Town" (tema del titulo) suene mientras el jugador
// todavia esta mirando esta pantalla — no una fraccion de segundo antes de navegar a otra. Recien
// despues de ese toque se revela el logo/tagline/boton "Jugar" real.
import { useState } from "react";

export default function TitleScreen({ onStart, onWake, onLab }) {
  const [awake, setAwake] = useState(false);

  const handleWake = () => {
    onWake();
    setAwake(true);
  };

  return (
    <div className="title-screen">
      <div className="title-art" />
      <div className="title-overlay" />

      {awake ? (
        <div className="title-content">
          <h1 className="title-logo">
            <span className="title-logo-bar">Bar</span>
            <span className="title-logo-codex">Codex</span>
          </h1>
          <p className="title-tagline">Escaneá un producto, invocá un héroe</p>

          <button type="button" className="scan-again title-play-btn" onClick={onStart}>
            ▶ Jugar
          </button>

          {onLab && (
            <button type="button" className="title-lab-link" onClick={onLab}>
              🃏 Prototipo del generador de cartas (beta)
            </button>
          )}
        </div>
      ) : (
        <button type="button" className="title-gate" onClick={handleWake}>
          <span className="title-gate-tap">Tocá para comenzar</span>
        </button>
      )}
    </div>
  );
}
