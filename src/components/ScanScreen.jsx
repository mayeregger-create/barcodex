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
        <p className="scan-screen-tagline">Apuntá la cámara a un código de barras</p>
        <button type="button" className="scan-again scan-cta" onClick={() => setShowCamera(true)}>
          📷 Escanear
        </button>
      </div>
    </div>
  );
}
