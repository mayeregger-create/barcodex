import { itemLabel, itemEffectDescription } from "../core/items.js";
import { RAREZA_TIER } from "../core/pixelArt/palette.js";
import PixelSprite from "./PixelSprite.jsx";

export default function ItemCard({ item, onScanAnother, onCodex, onBack, backLabel = "Volver al Codex" }) {
  return (
    <div className="result-card result-card--character">
      <div className="result-header">
        <div className={`result-portrait rareza-frame--${RAREZA_TIER[item.rareza]}`}>
          <PixelSprite item={item} />
        </div>

        <div className="result-heading">
          <div className="result-badge">{item.rareza} · {item.categoria}</div>
          <h2>{itemLabel(item)}</h2>
          <p className="result-sub">{itemEffectDescription(item)}</p>
        </div>
      </div>

      <div className="result-body pixel-scroll">
        <div className="result-code">{item.code}</div>
        <div className="result-block">
          <h3>Alcance</h3>
          <p>{item.alcance}</p>
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
