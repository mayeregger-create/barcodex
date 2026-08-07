const TABS = [
  { key: "scan", label: "Escanear", icon: "📷" },
  { key: "codex", label: "Codex", icon: "📖" },
  { key: "team", label: "Equipo", icon: "👥" },
  { key: "combat", label: "Combate", icon: "⚔️" },
];

/** Barra de navegación inferior fija — reemplaza la cadena de botones "Volver a X" (Fase 1).
 * `highlightKey` resalta un tab puntual con flecha + brillo (ver App.jsx: se usa para señalar
 * "Combate" apenas el jugador junta sus primeros 3 personajes). */
export default function BottomNav({ active, onNavigate, highlightKey }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const highlighted = tab.key === highlightKey;
        return (
          <button
            key={tab.key}
            type="button"
            className={`bottom-nav-tab${active === tab.key ? " bottom-nav-tab--active" : ""}${highlighted ? " bottom-nav-tab--highlight" : ""}`}
            onClick={() => onNavigate(tab.key)}
          >
            {highlighted && <span className="bottom-nav-highlight-arrow" aria-hidden="true">▲</span>}
            <span className="bottom-nav-icon" aria-hidden="true">{tab.icon}</span>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
