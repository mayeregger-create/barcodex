import { useState } from "react";
import { generateCharacter } from "../core/character.js";
import { generateItem, itemLabel } from "../core/items.js";
import { CONTINENT_ORDER, CONTINENT_HUE, HUES } from "../data/continents.js";
import { RAREZA_TIER, STAT_ACCENT } from "../core/pixelArt/palette.js";
import { CLASSES } from "../data/abilities.js";
import { getScannedCharacterCodes, getScannedItemCodes } from "../storage.js";
import CharacterCard from "./CharacterCard.jsx";
import ItemCard from "./ItemCard.jsx";
import PixelSprite from "./PixelSprite.jsx";

const ITEM_CATEGORIES = ["Elixir", "Arma", "Libro", "Armadura/Casco", "Accesorio", "Reliquia"];

/** Codex: tabs anidadas (Personajes/Items arriba, continente/categoria debajo) en vez de
 * acordeones — asi la grilla entra en una sola pantalla, sin scroll de pagina (ver index.css). */
export default function CodexScreen({ onScanAnother, onTeam }) {
  const characterCodes = getScannedCharacterCodes();
  const itemCodes = getScannedItemCodes();
  const characters = characterCodes.map(generateCharacter);
  const items = itemCodes.map(generateItem);

  const newestCharacterCode = characterCodes[characterCodes.length - 1] ?? null;
  const newestItemCode = itemCodes[itemCodes.length - 1] ?? null;
  const newestCharacterContinente = characters.find((c) => c.code === newestCharacterCode)?.continente;

  const [topTab, setTopTab] = useState("character");
  const [subFilter, setSubFilter] = useState(newestCharacterContinente ?? "Todos");
  const [selected, setSelected] = useState(null); // { kind: "character"|"item", code } | null

  const handleTopTab = (tab) => {
    setTopTab(tab);
    setSubFilter("Todos");
  };

  const selectedCharacter = selected?.kind === "character" ? generateCharacter(selected.code) : null;
  const selectedItem = selected?.kind === "item" ? generateItem(selected.code) : null;

  if (selectedCharacter) {
    const hue = HUES[CONTINENT_HUE[selectedCharacter.continente]];
    return (
      <div style={{ height: "100%", "--hue-bg": hue.bg, "--hue-mid": hue.mid, "--hue-dark": hue.dark }}>
        <CharacterCard character={selectedCharacter} onBack={() => setSelected(null)} backLabel="Volver" />
      </div>
    );
  }

  if (selectedItem) {
    return <ItemCard item={selectedItem} onBack={() => setSelected(null)} backLabel="Volver" />;
  }

  const subGroups = topTab === "character"
    ? CONTINENT_ORDER.map((continente) => ({ key: continente, pool: characters.filter((c) => c.continente === continente) }))
    : ITEM_CATEGORIES.map((categoria) => ({ key: categoria, pool: items.filter((i) => i.categoria === categoria) }));

  const allPool = topTab === "character" ? characters : items;
  const visiblePool = subFilter === "Todos" ? allPool : subGroups.find((g) => g.key === subFilter)?.pool ?? [];
  const visible = [...visiblePool].reverse();

  return (
    <div className="codex-screen">
      <div className="pixel-tabs">
        <button
          type="button"
          className={`pixel-tab${topTab === "character" ? " pixel-tab--active" : ""}`}
          onClick={() => handleTopTab("character")}
        >
          Personajes
        </button>
        <button
          type="button"
          className={`pixel-tab${topTab === "item" ? " pixel-tab--active" : ""}`}
          onClick={() => handleTopTab("item")}
        >
          Ítems
        </button>
      </div>

      <div className="pixel-subtabs">
        <button
          type="button"
          className={`pixel-subtab${subFilter === "Todos" ? " pixel-subtab--active" : ""}`}
          onClick={() => setSubFilter("Todos")}
        >
          Todos <span className="pixel-subtab-count">{allPool.length}</span>
        </button>
        {subGroups.map(({ key, pool }) => (
          <button
            key={key}
            type="button"
            className={`pixel-subtab${subFilter === key ? " pixel-subtab--active" : ""}`}
            disabled={pool.length === 0}
            onClick={() => setSubFilter(key)}
          >
            {key} <span className="pixel-subtab-count">{pool.length}</span>
          </button>
        ))}
      </div>

      <div className="codex-chips pixel-scroll">
        {visible.length === 0 && <p className="team-hint">Todavía no escaneaste nada acá.</p>}

        {visible.map((entry) =>
          topTab === "character" ? (
            <button
              key={entry.code}
              type="button"
              className={[
                "codex-chip",
                `codex-chip--${CONTINENT_HUE[entry.continente]}`,
                entry.code === newestCharacterCode ? "codex-chip--new" : "",
              ].join(" ").trim()}
              onClick={() => setSelected({ kind: "character", code: entry.code })}
            >
              <div className={`codex-chip-headshot rareza-frame--${RAREZA_TIER[entry.rareza]}`}>
                <PixelSprite character={entry} />
                <span className="clase-badge" style={{ background: STAT_ACCENT[entry.claseStat] }}>
                  {CLASSES[entry.claseStat].symbol}
                </span>
              </div>
              <span className="codex-chip-name">{entry.nombre}</span>
              <span className="codex-chip-rareza">{entry.rareza}</span>
            </button>
          ) : (
            <button
              key={entry.code}
              type="button"
              className={[
                "codex-chip",
                "codex-chip--item",
                entry.code === newestItemCode ? "codex-chip--new" : "",
              ].join(" ").trim()}
              onClick={() => setSelected({ kind: "item", code: entry.code })}
            >
              <div className={`codex-chip-headshot rareza-frame--${RAREZA_TIER[entry.rareza]}`}>
                <PixelSprite item={entry} />
              </div>
              <span className="codex-chip-name">{itemLabel(entry)}</span>
              <span className="codex-chip-rareza">{entry.rareza}</span>
            </button>
          )
        )}
      </div>

      <div className="result-actions">
        <button className="scan-again" onClick={onScanAnother}>
          Escanear otro
        </button>
        <button className="scan-again scan-again--secondary" onClick={onTeam}>
          Equipo
        </button>
      </div>
    </div>
  );
}
