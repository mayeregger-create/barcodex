import { useState } from "react";
import { generateCharacter } from "../core/character.js";
import { generateItem, itemLabel, itemEffectDescription } from "../core/items.js";
import { analyzeSquad, applyRarezaToBuffs } from "../core/squad.js";
import { CONTINENT_ORDER, CONTINENT_HUE } from "../data/continents.js";
import { RAREZA_TIER, STAT_ACCENT } from "../core/pixelArt/palette.js";
import { CLASSES } from "../data/abilities.js";
import { getScannedCharacterCodes, getScannedItemCodes } from "../storage.js";
import PixelSprite from "./PixelSprite.jsx";
import TeamDiagram from "./TeamDiagram.jsx";

const ROLE_LABEL = ["Principal", "Flanco 2", "Flanco 3"];
const ITEM_CATEGORIES = ["Elixir", "Arma", "Libro", "Armadura/Casco", "Accesorio", "Reliquia"];

function formatBuffs(buff) {
  const parts = [];
  if (buff.energia) parts.push(`Energía ${buff.energia > 0 ? "+" : ""}${buff.energia}/turno`);
  if (buff.critico) parts.push(`Crítico ${buff.critico > 0 ? "+" : ""}${buff.critico}%`);
  if (buff.defensa) parts.push(`Defensa ${buff.defensa > 0 ? "+" : ""}${buff.defensa}%`);
  if (buff.resistencia) parts.push(`Resistencia ${buff.resistencia > 0 ? "+" : ""}${buff.resistencia}%`);
  return parts.length > 0 ? parts.join(" · ") : "Sin bonus";
}

/** Hoja inferior: se abre al tocar un slot vacío, filtrada a lo que aún no está asignado. */
function PickerSheet({ kind, slot, characters, items, excludeCodes, onPick, onClose }) {
  const title = kind === "character" ? `Elegí a ${ROLE_LABEL[slot]}` : `Elegí un ítem para ${ROLE_LABEL[slot]}`;
  const groups = kind === "character"
    ? CONTINENT_ORDER.map((continente) => ({
        key: continente,
        label: continente,
        pool: characters.filter((c) => c.continente === continente && !excludeCodes.includes(c.code)).reverse(),
      }))
    : ITEM_CATEGORIES.map((categoria) => ({
        key: categoria,
        label: categoria,
        pool: items.filter((i) => i.categoria === categoria && !excludeCodes.includes(i.code)).reverse(),
      }));
  const hasAny = groups.some((g) => g.pool.length > 0);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>{title}</h3>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {!hasAny && <p className="team-hint">No hay {kind === "character" ? "personajes" : "ítems"} disponibles.</p>}

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
                    className={[
                      "codex-chip",
                      kind === "character" ? `codex-chip--${CONTINENT_HUE[key]}` : "codex-chip--item",
                    ].join(" ")}
                    onClick={() => onPick(entry.code)}
                  >
                    <div className={`codex-chip-headshot rareza-frame--${RAREZA_TIER[entry.rareza]}`}>
                      {kind === "character" ? (
                        <>
                          <PixelSprite character={entry} />
                          <span className="clase-badge" style={{ background: STAT_ACCENT[entry.claseStat] }}>
                            {CLASSES[entry.claseStat].symbol}
                          </span>
                        </>
                      ) : (
                        <PixelSprite item={entry} />
                      )}
                    </div>
                    <span className="codex-chip-name">{kind === "character" ? entry.nombre : itemLabel(entry)}</span>
                    <span className="codex-chip-rareza">{entry.rareza}</span>
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

export default function TeamScreen({ onScanAnother, onCodex, onCombat }) {
  const characters = getScannedCharacterCodes().map(generateCharacter);
  const items = getScannedItemCodes().map(generateItem);

  const [teamCodes, setTeamCodes] = useState([null, null, null]);
  const [itemCodes, setItemCodes] = useState([null, null, null]);
  const [picker, setPicker] = useState(null); // { kind: "character"|"item", slot: 0|1|2 } | null

  const team = teamCodes.map((code) => (code ? characters.find((c) => c.code === code) : null));
  const equippedItems = itemCodes.map((code) => (code ? items.find((i) => i.code === code) : null));
  const analysis = team.every(Boolean) ? analyzeSquad(team.map((c) => c.continente)) : null;
  const boostedBuffs = analysis ? applyRarezaToBuffs(analysis.buffs, team) : null;

  const handleSlotTap = (kind, slot) => {
    const filled = kind === "character" ? teamCodes[slot] : itemCodes[slot];
    if (filled) {
      const setter = kind === "character" ? setTeamCodes : setItemCodes;
      setter((prev) => prev.map((c, i) => (i === slot ? null : c)));
    } else {
      setPicker({ kind, slot });
    }
  };

  const handlePick = (code) => {
    if (!picker) return;
    const setter = picker.kind === "character" ? setTeamCodes : setItemCodes;
    setter((prev) => prev.map((c, i) => (i === picker.slot ? code : c)));
    setPicker(null);
  };

  return (
    <div className="team-screen">
      <h2>Equipo</h2>

      <div className="team-slots">
        {[0, 1, 2].map((i) => {
          const c = team[i];
          return (
            <button
              key={i}
              type="button"
              className={`team-slot${c ? "" : " team-slot--empty"}`}
              onClick={() => handleSlotTap("character", i)}
            >
              {c ? (
                <>
                  <div className={`team-slot-headshot rareza-frame--${RAREZA_TIER[c.rareza]}`}>
                    <PixelSprite character={c} />
                    <span className="clase-badge" style={{ background: STAT_ACCENT[c.claseStat] }}>
                      {CLASSES[c.claseStat].symbol}
                    </span>
                  </div>
                  <div className="team-slot-name">{c.nombre}</div>
                  <div className="team-slot-role">{ROLE_LABEL[i]}</div>
                </>
              ) : (
                <span className="team-slot-placeholder">+ {i === 0 ? "Elegí al principal" : "Vacío"}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="team-items-heading">Ítems del equipo</div>
      <div className="item-slots">
        {[0, 1, 2].map((i) => {
          const it = equippedItems[i];
          return (
            <button
              key={i}
              type="button"
              className={`item-slot${it ? "" : " item-slot--empty"}`}
              onClick={() => handleSlotTap("item", i)}
            >
              {it ? (
                <>
                  <div className={`item-slot-headshot rareza-frame--${RAREZA_TIER[it.rareza]}`}>
                    <PixelSprite item={it} />
                  </div>
                  <span className="item-slot-category">Para {team[i]?.nombre ?? ROLE_LABEL[i]}</span>
                  <span className="item-slot-label">{itemLabel(it)}</span>
                </>
              ) : (
                <span className="team-slot-placeholder">+ Vacío</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="team-body pixel-scroll">
        {analysis ? (
          <>
            <TeamDiagram team={team} analysis={analysis} />
            <div className="team-type">{analysis.tipo}</div>
            <div className="team-buffs">
              {team.map((c, i) => (
                <div className="team-buff-row" key={c.code}>
                  <span className="team-buff-name">{c.nombre}</span>
                  <span className="team-buff-values">{formatBuffs(boostedBuffs[i])}</span>
                </div>
              ))}
            </div>

            {equippedItems.some(Boolean) && (
              <>
                <div className="team-items-heading">Efectos de los ítems equipados</div>
                <div className="team-buffs">
                  {equippedItems.filter(Boolean).map((it) => (
                    <div className="team-buff-row" key={it.code}>
                      <span className="team-buff-name">{itemLabel(it)}</span>
                      <span className="team-buff-values">{itemEffectDescription(it)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : characters.length < 3 ? (
          <p className="team-hint">
            Necesitás escanear al menos 3 personajes para armar un equipo (llevás {characters.length}).
          </p>
        ) : (
          <p className="team-hint">Tocá un slot vacío para elegir personaje — el primero es el principal.</p>
        )}
      </div>

      {analysis && (
        <button className="scan-again combat-cta" onClick={() => onCombat(team, equippedItems)}>
          Combatir
        </button>
      )}

      <div className="result-actions">
        <button className="scan-again" onClick={onScanAnother}>
          Escanear otro
        </button>
        <button className="scan-again scan-again--secondary" onClick={onCodex}>
          Codex
        </button>
      </div>

      {picker && (
        <PickerSheet
          kind={picker.kind}
          slot={picker.slot}
          characters={characters}
          items={items}
          excludeCodes={(picker.kind === "character" ? teamCodes : itemCodes).filter(Boolean)}
          onPick={handlePick}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
