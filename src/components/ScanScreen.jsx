import { useState } from "react";
import BarcodeScanner from "./BarcodeScanner.jsx";
import { getScannedCharacterCodes } from "../storage.js";

const TEAM_SIZE = 3;

/** Pantalla de escaneo: la cámara es la única forma de sumar códigos (ver BarcodeScanner.jsx).
 * Esta vista de "reposo" es solo la invitación a escanear — Codex y Equipo ya están a un tab de
 * distancia en BottomNav, no hace falta duplicarlos acá. Mientras el jugador todavia no junto los
 * 3 personajes que hacen falta para un equipo, el encabezado se vuelve una guia de progreso en
 * vez del texto genérico — ver tambien BottomNav (el tab Combate se resalta al llegar a 3). */
export default function ScanScreen({ onScan }) {
  const [showCamera, setShowCamera] = useState(false);
  const scannedCount = Math.min(TEAM_SIZE, getScannedCharacterCodes().length);
  const onboarding = scannedCount < TEAM_SIZE;

  const handleDetected = (digits12) => {
    setShowCamera(false);
    onScan(digits12);
  };

  if (showCamera) {
    return <BarcodeScanner onDetected={handleDetected} onClose={() => setShowCamera(false)} />;
  }

  return (
    <div className="scan-screen">
      <div className="scan-screen-art" />
      <div className="scan-screen-overlay" />

      <div className="scan-screen-content">
        <div className="scan-hint-barcode">
          <div className="scan-hint-barcode-bars" />
          <div className="scan-hint-barcode-beam" />
        </div>

        <h2 className="scan-screen-heading">
          {onboarding ? "Armá tu primer equipo" : "Escaneá un producto real"}
        </h2>
        <p className="scan-screen-tagline">
          {onboarding
            ? `Escaneá ${TEAM_SIZE} productos distintos para desbloquear el combate`
            : "Cualquier código de barras sirve — de tu casa, un kiosco, lo que sea"}
        </p>

        {onboarding && (
          <div className="scan-onboard-dots">
            {Array.from({ length: TEAM_SIZE }, (_, i) => (
              <span key={i} className={`scan-onboard-dot${i < scannedCount ? " scan-onboard-dot--done" : ""}`} />
            ))}
          </div>
        )}

        <div className="scan-steps">
          <div className="scan-step">
            <span className="scan-step-icon">📦</span>
            <span className="scan-step-label">Elegí un producto</span>
          </div>
          <span className="scan-step-arrow">›</span>
          <div className="scan-step">
            <span className="scan-step-icon">📷</span>
            <span className="scan-step-label">Enfocá el código</span>
          </div>
          <span className="scan-step-arrow">›</span>
          <div className="scan-step">
            <span className="scan-step-icon">✨</span>
            <span className="scan-step-label">¡Listo!</span>
          </div>
        </div>

        <button type="button" className="scan-again scan-cta" onClick={() => setShowCamera(true)}>
          📷 Escanear ahora
        </button>
      </div>
    </div>
  );
}
