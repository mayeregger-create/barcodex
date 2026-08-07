import { useState } from "react";
import BarcodeScanner from "./BarcodeScanner.jsx";

/** Pantalla de escaneo: la cámara es la única forma de sumar códigos (ver BarcodeScanner.jsx).
 * Esta vista de "reposo" es solo la invitación a escanear — Codex y Equipo ya están a un tab de
 * distancia en BottomNav, no hace falta duplicarlos acá. */
export default function ScanScreen({ onScan }) {
  const [showCamera, setShowCamera] = useState(false);

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

        <h2 className="scan-screen-heading">Escaneá un producto real</h2>
        <p className="scan-screen-tagline">Cualquier código de barras sirve — de tu casa, un kiosco, lo que sea</p>

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
