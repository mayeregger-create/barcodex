import { useState } from "react";
import { generateCharacter } from "../core/character.js";
import { getScannedCharacterCodes } from "../storage.js";
import { GRID_ROWS, GRID_COLS, MAX_UNITS, slotAt, autoFormation } from "../core/gridCombat.js";
import { CONTINENT_ORDER, CONTINENT_HUE } from "../data/continents.js";
import { CLASSES } from "../data/abilities.js";
import { RAREZA_TIER, STAT_ACCENT } from "../core/pixelArt/palette.js";
import PixelSprite from "./PixelSprite.jsx";

const ROW_LABEL = ["Frente", "Medio", "Fondo"];

/** Hoja para elegir con qué personaje llenar un casillero — mismo lenguaje visual que el picker
 * de Equipo (TeamScreen.jsx), agrupado por continente. */
function PickerSheet({ slot, characters, placedCodes, onPick, onClose }) {
  const groups = CONTINENT_ORDER.map((continente) => ({
    key: continente,
    label: continente,
    pool: characters.filter((c) => c.continente === continente && !placedCodes.includes(c.code)).reverse(),
  }));
  const hasAny = groups.some((g) => g.pool.length > 0);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Elegí quién ocupa este casillero</h3>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {!hasAny && <p className="team-hint">No te quedan personajes libres para ubicar.</p>}

        {groups.map(({ key, label, pool }) => {
          if (pool.length === 0) return null;
          return (
            <div key={key}>
              <div className="codex-group-header">
                <span>{label}</span>
                <span className="codex-count">{pool.length}</span>
              </div>
              <div className="codex-chips">
                {pool.map((entry) => (
                  <button
                    key={entry.code}
                    type="button"
                    className={`codex-chip codex-chip--${CONTINENT_HUE[key]}`}
                    onClick={() => onPick(slot, entry.code)}
                  >
                    <div className={`codex-chip-headshot rareza-frame--${RAREZA_TIER[entry.rareza]}`}>
                      <PixelSprite character={entry} />
                      <span className="clase-badge" style={{ background: STAT_ACCENT[entry.claseStat] }}>
                        {CLASSES[entry.claseStat].symbol}
                      </span>
                    </div>
                    <span className="codex-chip-name">{entry.nombre}</span>
                    <span className="codex-chip-rareza">{entry.clase}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Armado del tablero 3x3 para Teamfight Tactics: hasta 5 de tus personajes escaneados, en el
 * casillero que elijas. La Clase de cada uno decide cómo pelea despues (ver gridCombat.js) — acá
 * solo se posiciona. "Auto" delega el acomodo a autoFormation() para no obligar a acomodar a mano
 * en esta etapa de demo. */
export default function TftBoardScreen({ onBack, onFight }) {
  const characters = getScannedCharacterCodes().map(generateCharacter);
  const [placements, setPlacements] = useState([]); // [{ slot, character }]
  const [pickerSlot, setPickerSlot] = useState(null);

  const placedCodes = placements.map((p) => p.character.code);
  const bySlot = (slot) => placements.find((p) => p.slot === slot) || null;

  const handleSlotTap = (slot) => {
    const existing = bySlot(slot);
    if (existing) {
      setPlacements((prev) => prev.filter((p) => p.slot !== slot));
    } else if (placements.length < MAX_UNITS) {
      setPickerSlot(slot);
    }
  };

  const handlePick = (slot, code) => {
    const character = characters.find((c) => c.code === code);
    setPlacements((prev) => [...prev, { slot, character }]);
    setPickerSlot(null);
  };

  const handleAuto = () => {
    const available = characters.filter((c) => !placedCodes.includes(c.code));
    const next = autoFormation([...placements.map((p) => p.character), ...available].slice(0, MAX_UNITS));
    setPlacements(next);
  };

  const rows = Array.from({ length: GRID_ROWS }, (_, r) => r);

  return (
    <div className="tft-board-screen">
      <h2>Formación — Teamfight Tactics</h2>
      <p className="mode-select-hint">
        {characters.length === 0
          ? "Todavía no escaneaste ningún personaje."
          : `Ubicá hasta ${MAX_UNITS} en el tablero (${placements.length}/${MAX_UNITS}) — la fila de arriba pelea de frente.`}
      </p>

      <div className="tft-grid tft-grid--placement">
        {rows.map((row) => (
          <div className="tft-grid-row" key={row}>
            <span className="tft-row-label">{ROW_LABEL[row]}</span>
            <div className="tft-grid-cells">
              {Array.from({ length: GRID_COLS }, (_, col) => {
                const slot = slotAt(row, col);
                const entry = bySlot(slot);
                const c = entry?.character;
                return (
                  <button
                    type="button"
                    key={slot}
                    className={`tft-cell${c ? "" : " tft-cell--empty"}`}
                    onClick={() => handleSlotTap(slot)}
                    disabled={!c && placements.length >= MAX_UNITS}
                  >
                    {c ? (
                      <>
                        <div className={`tft-cell-headshot rareza-frame--${RAREZA_TIER[c.rareza]}`}>
                          <PixelSprite character={c} />
                          <span className="clase-badge" style={{ background: STAT_ACCENT[c.claseStat] }}>
                            {CLASSES[c.claseStat].symbol}
                          </span>
                        </div>
                        <span className="tft-cell-name">{c.nombre}</span>
                      </>
                    ) : (
                      <span className="tft-cell-plus">+</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="tft-board-actions">
        <button type="button" className="scan-again scan-again--secondary" onClick={handleAuto} disabled={characters.length === 0}>
          🎲 Auto
        </button>
        <button
          type="button"
          className="scan-again mode-card--tft-cta"
          onClick={() => onFight(placements)}
          disabled={placements.length === 0}
        >
          Pelear
        </button>
      </div>

      <div className="result-actions">
        <button className="scan-again scan-again--secondary" onClick={onBack}>Volver</button>
      </div>

      {pickerSlot !== null && (
        <PickerSheet
          slot={pickerSlot}
          characters={characters}
          placedCodes={placedCodes}
          onPick={handlePick}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
