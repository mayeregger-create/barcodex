import PixelSprite from "./PixelSprite.jsx";
import { RAREZA_TIER, STAT_ACCENT } from "../core/pixelArt/palette.js";
import { CLASSES } from "../data/abilities.js";

const REL_COLOR = { afin: "#1D9E75", rival: "#D85A30", mismo: "#999999" };
const REL_LABEL = { afin: "Afines", rival: "Rivales", mismo: "Mismo continente" };
const POS = [
  { x: 50, y: 22 },
  { x: 18, y: 82 },
  { x: 82, y: 82 },
];

export default function TeamDiagram({ team, analysis }) {
  const edges = [
    { from: 0, to: 1, rel: analysis.pairRelations.principal_miembro2 },
    { from: 0, to: 2, rel: analysis.pairRelations.principal_miembro3 },
    { from: 1, to: 2, rel: analysis.pairRelations.miembro2_miembro3 },
  ];

  return (
    <div className="team-diagram">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="team-diagram-svg">
        {edges.map(({ from, to, rel }) => (
          <line
            key={`${from}-${to}`}
            x1={POS[from].x}
            y1={POS[from].y}
            x2={POS[to].x}
            y2={POS[to].y}
            stroke={REL_COLOR[rel]}
            strokeWidth="1.2"
            strokeDasharray={rel === "mismo" ? "3 2" : "0"}
          />
        ))}
      </svg>

      {team.map((c, i) => (
        <div key={c.code} className="team-diagram-node" style={{ left: `${POS[i].x}%`, top: `${POS[i].y}%` }}>
          <div className={`team-diagram-avatar rareza-frame--${RAREZA_TIER[c.rareza]}`}>
            <PixelSprite character={c} />
            <span className="clase-badge" style={{ background: STAT_ACCENT[c.claseStat] }}>
              {CLASSES[c.claseStat].symbol}
            </span>
          </div>
          <div className="team-diagram-name">{c.nombre}</div>
        </div>
      ))}

      <div className="team-diagram-legend">
        {edges.map(({ from, to, rel }) => (
          <span className="team-diagram-legend-item" key={`${from}-${to}`}>
            <span className="team-diagram-legend-dot" style={{ background: REL_COLOR[rel] }} />
            {team[from].nombre} – {team[to].nombre}: {REL_LABEL[rel]}
          </span>
        ))}
      </div>
    </div>
  );
}
