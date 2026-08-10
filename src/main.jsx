import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Etapa de demo: sin service worker por ahora (ver public/sw.js — kill-switch para limpiar
// instalaciones viejas que dejaban el juego atascado en una build vieja, solo esquivable
// entrando en modo incógnito). No registramos uno nuevo; a quien ya tenga el viejo activo, el
// navegador lo actualiza solo la próxima vez que visite (chequeo automático de update en cada
// navegación dentro del scope) y el kill-switch se autodestruye.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}
