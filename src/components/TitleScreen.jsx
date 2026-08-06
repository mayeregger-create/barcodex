// src/components/TitleScreen.jsx
// Pantalla de titulo, a pantalla completa (sin header ni bottom nav — ver App.jsx). El fondo
// (.title-art) apunta a /title-bg.png: mientras no exista ese archivo se ve el degrade de
// respaldo definido en CSS, asi nunca se ve "roto". Para poner la ilustracion final, basta con
// agregar public/title-bg.png con ese nombre exacto — no hace falta tocar este componente.
export default function TitleScreen({ onStart }) {
  return (
    <div className="title-screen">
      <div className="title-art" />
      <div className="title-overlay" />

      <div className="title-content">
        <h1 className="title-logo">
          <span className="title-logo-bar">Bar</span>
          <span className="title-logo-codex">Codex</span>
        </h1>
        <p className="title-tagline">Escaneá un producto, invocá un héroe</p>

        <button type="button" className="scan-again title-play-btn" onClick={onStart}>
          ▶ Jugar
        </button>
      </div>
    </div>
  );
}
