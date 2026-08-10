import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";

// Solo los formatos que dan un numero de producto compatible con nuestro esquema (12-13 digitos):
// EAN-13 (el estandar mundial) y UPC-A (el equivalente en EEUU/Canada, 12 digitos). Restringir los
// formatos acelera la decodificacion — menos patrones a probar por frame.
const HINTS = new Map();
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A]);

/** De lo que devuelve el lector a los 12 digitos que pide core/character.js#checkDigit — igual
 * que la carga manual, siempre recalculamos nosotros el digito verificador en vez de confiar en
 * el del producto real: no nos interesa si el codigo es "valido", solo que sean 12 digitos
 * consistentes (esa es la gracia del juego, cualquier codigo sirve). */
function toDigits12(text) {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 13) return digits.slice(0, 12);
  if (digits.length === 12) return digits;
  return null;
}

/** 12 dígitos al azar — App#resolveScan calcula el verificador y arma el código de 13. Provisorio
 * para la etapa de demo: cubre a quien no tiene un producto real a mano para escanear. */
function randomDigits12() {
  let d = "";
  for (let i = 0; i < 12; i++) d += Math.floor(Math.random() * 10);
  return d;
}

function errorMessage(err) {
  if (err?.name === "NotAllowedError") return "Sin permiso de cámara — habilitalo en los ajustes del navegador.";
  if (err?.name === "NotFoundError") return "No se encontró ninguna cámara en este dispositivo.";
  if (err?.name === "NotReadableError") return "La cámara está siendo usada por otra app.";
  return "No se pudo iniciar la cámara.";
}

/** Vista de camara en vivo: decodifica EAN-13/UPC-A del video y llama a onDetected(digits12) una
 * sola vez que encuentra algo. Necesita contexto seguro (HTTPS o localhost). */
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!window.isSecureContext) {
      setError("La cámara necesita HTTPS. Esta pestaña no es un contexto seguro.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no soporta acceso a la cámara.");
      return;
    }

    const reader = new BrowserMultiFormatReader(HINTS);
    let cancelled = false;
    let controls;

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current,
        (result) => {
          if (cancelled || detectedRef.current || !result) return;
          const digits12 = toDigits12(result.getText());
          if (!digits12) return; // formato inesperado, seguir escaneando
          detectedRef.current = true;
          onDetected(digits12);
        }
      )
      .then((c) => {
        if (cancelled) c.stop();
        else controls = c;
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRandom = () => {
    if (detectedRef.current) return;
    detectedRef.current = true;
    onDetected(randomDigits12());
  };

  return (
    <div className="scanner-screen">
      <div className="scanner-viewport">
        <video ref={videoRef} className="scanner-video" muted playsInline />
        {!error && <div className="scanner-frame" aria-hidden="true" />}
        {error && <p className="scan-error scanner-error">{error}</p>}
      </div>
      <p className="scanner-hint">{error ? "Podés escribir el código a mano." : "Apuntá al código de barras del producto."}</p>
      <button type="button" className="scan-again scan-again--random" onClick={handleRandom}>
        🎲 Generar personaje random <span className="scan-again--random-tag">(provisorio)</span>
      </button>
      <button type="button" className="scan-again scan-again--secondary" onClick={onClose}>
        {error ? "Volver" : "Cancelar"}
      </button>
    </div>
  );
}
