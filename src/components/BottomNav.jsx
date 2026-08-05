const TABS = [
  { key: "scan", label: "Escanear", icon: "📷" },
  { key: "codex", label: "Codex", icon: "📖" },
  { key: "team", label: "Equipo", icon: "👥" },
  { key: "combat", label: "Combate", icon: "⚔️" },
];

/** Barra de navegación inferior fija — reemplaza la cadena de botones "Volver a X" (Fase 1). */
export default function BottomNav({ active, onNavigate }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`bottom-nav-tab${active === tab.key ? " bottom-nav-tab--active" : ""}`}
          onClick={() => onNavigate(tab.key)}
        >
          <span className="bottom-nav-icon" aria-hidden="true">{tab.icon}</span>
          <span className="bottom-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
