import { useEffect, useState } from "react";
import {
  GRID_ROWS,
  GRID_COLS,
  slotAt,
  autoFormation,
  randomRivalCharacters,
  initialGridBattle,
  advanceGridTurn,
} from "../core/gridCombat.js";
import { CLASSES } from "../data/abilities.js";
import { STAT_ACCENT } from "../core/pixelArt/palette.js";
import PixelSprite from "./PixelSprite.jsx";
import BattleSummary from "./BattleSummary.jsx";

const SPEED_DELAY = { 1: 1100, 2: 550 };

/** Rival de CPU: tantos personajes al azar como el jugador haya ubicado (pelea pareja), acomodados
 * con la misma autoFormation() que usa el botón "Auto" del jugador. */
function makeInitialBattle(playerPlacements) {
  const rivalPlacements = autoFormation(randomRivalCharacters(playerPlacements.length));
  return initialGridBattle(playerPlacements, rivalPlacements);
}

/** Batalla del modo Teamfight Tactics: 2 tableros 3x3 espejados contra una división central (la
 * fila "Frente" de cada uno queda pegada a esa división), autobattle igual que Partida Rápida
 * (ver CombatScreen.jsx) pero resolviendo turno por turno sobre TODo el tablero en vez de 1vs1 —
 * ver gridCombat.js#advanceGridTurn. */
export default function TftCombatScreen({ playerPlacements, onExit }) {
  const [battle, setBattle] = useState(() => makeInitialBattle(playerPlacements));
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (battle.phase !== "battle") return;
    const timeout = setTimeout(() => {
      setBattle((prev) => (prev.phase === "battle" ? advanceGridTurn(prev) : prev));
    }, SPEED_DELAY[speed]);
    return () => clearTimeout(timeout);
  }, [battle.playerBoard, battle.rivalBoard, battle.queue, battle.phase, speed]);

  const restart = () => setBattle(makeInitialBattle(playerPlacements));

  if (battle.phase === "over") {
    return (
      <BattleSummary
        battle={{
          player: battle.playerBoard.filter(Boolean),
          rival: battle.rivalBoard.filter(Boolean),
          winner: battle.winner,
        }}
        onRestart={restart}
        onTeam={onExit}
        restartLabel="Otra batalla"
        backLabel="Volver"
      />
    );
  }

  return (
    <div className="tft-combat-screen">
      <div className="tft-grid tft-grid--battle">
        {[2, 1, 0].map((row) => (
          <div className="tft-grid-cells" key={row}>
            {Array.from({ length: GRID_COLS }, (_, col) => {
              const slot = slotAt(row, col);
              const acting = battle.lastActor?.side === "rival" && battle.lastActor?.slot === slot;
              return <TftCell key={slot} battler={battle.rivalBoard[slot]} acting={acting} />;
            })}
          </div>
        ))}
      </div>

      <div className="tft-divider">
        <span>VS</span>
      </div>

      <div className="tft-grid tft-grid--battle">
        {[0, 1, 2].map((row) => (
          <div className="tft-grid-cells" key={row}>
            {Array.from({ length: GRID_COLS }, (_, col) => {
              const slot = slotAt(row, col);
              const acting = battle.lastActor?.side === "player" && battle.lastActor?.slot === slot;
              return <TftCell key={slot} battler={battle.playerBoard[slot]} acting={acting} />;
            })}
          </div>
        ))}
      </div>

      <div className="combat-log pixel-scroll tft-log">
        {battle.log.slice(-6).map((line, i) => (
          <div key={i} className="combat-log-line">{line}</div>
        ))}
      </div>

      <div className="combat-actions">
        <button
          type="button"
          className="scan-again scan-again--secondary combat-speed-btn"
          onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
        >
          Velocidad ×{speed}
        </button>
      </div>
    </div>
  );
}

function TftCell({ battler, acting }) {
  if (!battler) return <div className="tft-cell tft-cell--void" aria-hidden="true" />;
  const { character, hp, alive } = battler;
  const hpPct = Math.max(0, Math.round((hp / character.hpMax) * 100));
  return (
    <div
      className={`tft-cell tft-cell--battle${alive ? "" : " tft-cell--dead"}${acting ? " tft-cell--acting" : ""}`}
    >
      <div className="tft-cell-headshot">
        <PixelSprite character={character} />
        <span className="clase-badge" style={{ background: STAT_ACCENT[character.claseStat] }}>
          {CLASSES[character.claseStat].symbol}
        </span>
      </div>
      <div className="tft-cell-hp-bar">
        <div className="tft-cell-hp-fill" style={{ width: `${hpPct}%` }} />
      </div>
    </div>
  );
}
