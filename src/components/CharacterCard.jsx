import { RAREZA_TIER, STAT_ACCENT } from "../core/pixelArt/palette.js";
import { CLASSES } from "../data/abilities.js";
import PixelSprite from "./PixelSprite.jsx";
import Barcode from "./Barcode.jsx";

const STAT_LABELS = ["Fuerza", "Velocidad", "Defensa", "Energia", "Suerte"];

function Portrait({ character }) {
  return (
    <div className={`result-portrait-big rareza-frame--${RAREZA_TIER[character.rareza]}`}>
      <PixelSprite character={character} />
      <span className="clase-badge" style={{ background: STAT_ACCENT[character.claseStat] }}>
        {CLASSES[character.claseStat].symbol}
      </span>
    </div>
  );
}

export default function CharacterCard({ character, onScanAnother, onCodex, onBack, backLabel = "Volver al Codex" }) {
  const { code, nombre, rol, epiteto, clase, sexo, continente, trait, rareza, habilidad, stats, hp, parry } = character;

  return (
    <div className="result-card result-card--character">
      <div className="result-hero">
        <Portrait character={character} />
        <div className="result-heading">
          <div className="result-badge">{rareza}</div>
          <h2>{nombre}</h2>
          <div className="result-epithet">{rol} {epiteto}</div>
          <div className="result-sub">
            {clase} · {sexo} · {continente}
          </div>
        </div>
      </div>

      <div className="result-barcode-panel">
        <Barcode code={code} className="result-barcode-svg" />
        <div className="result-code">{code}</div>
      </div>

      <div className="result-body pixel-scroll">
        <div className="stat-grid">
          {STAT_LABELS.map((k) => (
            <div className="stat-row" key={k}>
              <div className="stat-row-top">
                <span className="stat-label">{k}</span>
                <span className="stat-value">{stats[k]}</span>
              </div>
              <div className="stat-bar">
                <div className="stat-fill" style={{ width: `${(stats[k] / 20) * 100}%` }} />
              </div>
            </div>
          ))}
          <div className="stat-row stat-row--hp">
            <div className="stat-row-top">
              <span className="stat-label">HP</span>
              <span className="stat-value">{hp}</span>
            </div>
            <div className="stat-bar">
              <div className="stat-fill" style={{ width: "100%" }} />
            </div>
          </div>
        </div>

        <div className="result-block">
          <h3>Trait de {continente}</h3>
          <p>{trait.desc}</p>
        </div>

        <div className="result-block">
          <h3>Habilidad especial: {habilidad.name}</h3>
          <p>{habilidad.desc}</p>
          <span className="tag">{habilidad.tipo}</span>
        </div>

        <div className="result-block">
          <h3>Parry</h3>
          <p>
            Bloqueo: {parry.block === null ? "Suerte/100 (20%–80%)" : `${Math.round(parry.block * 100)}%`}
            {" · "}
            Reflejo: {parry.reflect === null ? "aleatorio 20%–80%" : `${Math.round(parry.reflect * 100)}%`}
          </p>
        </div>
      </div>

      {(onScanAnother || onCodex || onBack) && (
        <div className="result-actions">
          {onBack ? (
            <button className="scan-again" onClick={onBack}>
              {backLabel}
            </button>
          ) : (
            <>
              <button className="scan-again" onClick={onScanAnother}>
                Escanear otro
              </button>
              <button className="scan-again scan-again--secondary" onClick={onCodex}>
                Codex
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
