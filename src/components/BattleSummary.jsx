// src/components/BattleSummary.jsx
// Pantalla de cierre del combate (CombatScreen.jsx la renderiza en vez de las filas de batalla
// cuando battle.phase === "over") — la recompensa despues de pelear: quien fue el MVP, cuanto
// daño hizo cada bando, y como le fue a cada uno de tus 3 personajes. Los totales que usa
// (totalDamageDealt/totalDamageTaken/abilitiesUsedCount/parriesBlockedCount) se acumulan durante
// todo el combate en CombatScreen.jsx#performAction — a proposito NUNCA se resetean, a diferencia
// de hitsTaken/hitsDealt (esos son la moneda de cargas de Parry/Habilidad, se consumen).
import { useEffect } from "react";
import { RAREZA_TIER } from "../core/pixelArt/palette.js";
import PixelSprite from "./PixelSprite.jsx";
import { sfxVictory, sfxDefeat } from "../audio.js";

function sideTotal(side, field) {
  return side.reduce((sum, b) => sum + (b[field] || 0), 0);
}

function TotalBar({ label, you, rival }) {
  const max = Math.max(you, rival, 1);
  return (
    <div className="battle-summary-bar-row">
      <div className="battle-summary-bar-label">{label}</div>
      <div className="battle-summary-bar-line">
        <span className="battle-summary-bar-tag">Vos</span>
        <div className="battle-summary-bar-track">
          <div className="battle-summary-bar-fill battle-summary-bar-fill--you" style={{ width: `${Math.round((you / max) * 100)}%` }} />
        </div>
        <span className="battle-summary-bar-value">{you}</span>
      </div>
      <div className="battle-summary-bar-line">
        <span className="battle-summary-bar-tag">Rival</span>
        <div className="battle-summary-bar-track">
          <div className="battle-summary-bar-fill battle-summary-bar-fill--rival" style={{ width: `${Math.round((rival / max) * 100)}%` }} />
        </div>
        <span className="battle-summary-bar-value">{rival}</span>
      </div>
    </div>
  );
}

export default function BattleSummary({ battle, onRestart, onTeam, restartLabel = "Otro combate", backLabel = "Volver al Equipo" }) {
  const { player, rival, winner } = battle;

  // Suena una sola vez al montar (esta pantalla se monta exactamente una vez por combate
  // terminado — "Otro combate" recrea el estado desde cero, ver CombatScreen.jsx#restart).
  useEffect(() => {
    if (winner === "player") sfxVictory();
    else sfxDefeat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mvp = [...player].sort((a, b) => (b.totalDamageDealt || 0) - (a.totalDamageDealt || 0))[0];

  const playerDmg = sideTotal(player, "totalDamageDealt");
  const rivalDmg = sideTotal(rival, "totalDamageDealt");
  const playerAbilities = sideTotal(player, "abilitiesUsedCount");
  const rivalAbilities = sideTotal(rival, "abilitiesUsedCount");
  const playerParries = sideTotal(player, "parriesBlockedCount");
  const rivalParries = sideTotal(rival, "parriesBlockedCount");

  return (
    <div className="battle-summary">
      <div className={`battle-summary-banner battle-summary-banner--${winner}`}>
        {winner === "player" ? "¡Victoria!" : "Derrota"}
      </div>

      <div className="battle-summary-mvp">
        <div className={`battle-summary-mvp-portrait rareza-frame--${RAREZA_TIER[mvp.character.rareza]}`}>
          <PixelSprite character={mvp.character} />
        </div>
        <div className="battle-summary-mvp-info">
          <span className="battle-summary-mvp-tag">MVP</span>
          <h3>{mvp.character.nombre}</h3>
          <span className="battle-summary-mvp-line">{mvp.totalDamageDealt || 0} de daño hecho</span>
        </div>
      </div>

      <div className="battle-summary-totals">
        <TotalBar label="Daño hecho" you={playerDmg} rival={rivalDmg} />
        <div className="battle-summary-count-row">
          <span>Habilidades usadas</span>
          <span>Vos {playerAbilities} — Rival {rivalAbilities}</span>
        </div>
        <div className="battle-summary-count-row">
          <span>Parry bloqueados</span>
          <span>Vos {playerParries} — Rival {rivalParries}</span>
        </div>
      </div>

      <div className="battle-summary-roster pixel-scroll">
        {player.map((b) => (
          <div key={b.character.code} className={`battle-summary-row${!b.alive ? " battle-summary-row--dead" : ""}`}>
            <div className="battle-summary-row-headshot">
              <PixelSprite character={b.character} />
            </div>
            <div className="battle-summary-row-name">{b.character.nombre}</div>
            <div className="battle-summary-row-stats">
              <span title="Daño hecho">⚔️ {b.totalDamageDealt || 0}</span>
              <span title="Daño recibido">🛡️ {b.totalDamageTaken || 0}</span>
              <span title="Habilidades usadas">✨ {b.abilitiesUsedCount || 0}</span>
              {!b.alive && <span className="battle-summary-row-fallen">Caído</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="result-actions">
        <button className="scan-again" onClick={onRestart}>{restartLabel}</button>
        <button className="scan-again scan-again--secondary" onClick={onTeam}>{backLabel}</button>
      </div>
    </div>
  );
}
