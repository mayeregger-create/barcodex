/** Puerta de entrada a Combate: elegir entre el duelo 1vs1 de siempre (Partida Rápida) y el
 * tablero 3x3 nuevo (Teamfight Tactics) — ver charla en el chat sobre las 2 modalidades. Pantalla
 * chica a proposito, solo decide a donde navegar despues. */
export default function ModeSelectScreen({ onQuick, onTft }) {
  return (
    <div className="mode-select-screen">
      <h2>Elegí modalidad</h2>
      <p className="mode-select-hint">¿Cómo querés combatir esta vez?</p>

      <button type="button" className="mode-card" onClick={onQuick}>
        <span className="mode-card-icon" aria-hidden="true">⚔️</span>
        <span className="mode-card-title">Partida Rápida</span>
        <span className="mode-card-desc">Duelo 1 contra 1 — armá tu equipo de 3 y peleá.</span>
      </button>

      <button type="button" className="mode-card mode-card--tft" onClick={onTft}>
        <span className="mode-card-icon" aria-hidden="true">🎯</span>
        <span className="mode-card-title">Teamfight Tactics</span>
        <span className="mode-card-desc">Tablero 3x3 — ubicá hasta 5 personajes y que cada Clase pelee a su manera.</span>
        <span className="mode-card-tag">Nuevo</span>
      </button>
    </div>
  );
}
