import { useState } from "react";

/** Pantalla de "escaneo" manual: el usuario tipea los 12 digitos que ve bajo el codigo de barras.
 * El 13avo (verificador) lo calcula el motor de reglas — ver App.jsx / core/character.js#checkDigit. */
export default function ScanScreen({ onScan, onCodex, onTeam, onRandomGenerate }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(false);

  const handleRandomGenerate = () => {
    onRandomGenerate();
    setGenerated(true);
    setTimeout(() => setGenerated(false), 2000);
  };

  const handleChange = (e) => {
    const clean = e.target.value.replace(/\D/g, "").slice(0, 12);
    setDigits(clean);
    if (error) setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (digits.length !== 12) {
      setError("Ingresá exactamente 12 dígitos.");
      return;
    }
    onScan(digits);
  };

  return (
    <form className="scan-screen" onSubmit={handleSubmit}>
      <label htmlFor="barcode-input">Código de barras (12 dígitos)</label>
      <input
        id="barcode-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="000000000000"
        value={digits}
        onChange={handleChange}
        maxLength={12}
        autoFocus
      />
      <div className="scan-count">{digits.length}/12</div>
      {error && <div className="scan-error">{error}</div>}
      <button type="submit" disabled={digits.length !== 12}>
        Escanear
      </button>

      <div className="result-actions">
        <button type="button" className="scan-again scan-again--secondary" onClick={onCodex}>
          Codex
        </button>
        <button type="button" className="scan-again scan-again--secondary" onClick={onTeam}>
          Equipo
        </button>
      </div>

      {onRandomGenerate && (
        <div className="dev-tools">
          <button type="button" className="dev-tools-btn" onClick={handleRandomGenerate}>
            🎲 Reiniciar datos de prueba (6 + 6)
          </button>
          {generated && <span className="dev-tools-confirm">✓ 6 personajes + 6 ítems (reemplazados)</span>}
        </div>
      )}
    </form>
  );
}
