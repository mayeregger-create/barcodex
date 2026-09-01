// src/components/BoardPrototype.jsx
// Prototipo de la grilla cenital (ver chat: "puntos de vista") + la idea central del sistema
// nuevo hecha visible de verdad — cuando una zona se rompe, la pieza de Titiritero se desprende y
// queda colgando del remache en vivo (gameZones.js), no una barra de vida abstracta. Motor de
// combate REAL (src/combat/), avanzado a mano un golpe a la vez para poder mirarlo.
//
// Dos fases: "deploy" (tu mano, tocas una carta y el tablero te muestra donde la podes ubicar +
// que le va a llegar del lado rival — la "capa transparente" del chat) y "battle" (igual que antes,
// golpe a golpe). El rival se sigue autodesplegando (autoDeploy) — la interaccion es solo tuya.
import { useEffect, useRef, useState } from "react";
import { generateCard } from "../cardgen/card.js";
import { autoDeploy, makeBattler, POSITIONS, NUCLEO_BASE } from "../combat/board.js";
import { resolveAttack, checkCollapse } from "../combat/resolve.js";
import { DAMAGE_TYPES } from "../cardgen/classGen.js";
import { mountBoardToken } from "../titiritero/index.js";

const HAND_SIZE = 5;
const TYPE_LABEL = { pierce: "Pierce", cut: "Cut", blunt: "Blunt", magic: "Magic" };
const STATION_SYMBOL = { 1: "1", 2: "2", 3: "3" };

function randomCode13() {
  let d = "";
  for (let i = 0; i < 13; i++) d += Math.floor(Math.random() * 10);
  return d;
}

function freshMatch() {
  const hand = Array.from({ length: HAND_SIZE }, () => generateCard(randomCode13()));
  const rivalCards = Array.from({ length: 3 }, () => generateCard(randomCode13()));
  const { board: boardB } = autoDeploy(rivalCards);
  return {
    phase: "deploy",
    hand,
    boardA: { 1: null, 2: null, 3: null },
    boardB,
    nucleoA: { hp: NUCLEO_BASE },
    nucleoB: { hp: NUCLEO_BASE },
    round: 0,
    queue: [],
  };
}

function buildQueue(state) {
  const tagged = [];
  for (const p of POSITIONS) if (state.boardA[p]) tagged.push({ battler: state.boardA[p], side: "A" });
  for (const p of POSITIONS) if (state.boardB[p]) tagged.push({ battler: state.boardB[p], side: "B" });
  const priorityFirst = state.round % 2 === 1 ? "A" : "B";
  tagged.sort((x, y) => {
    if (y.battler.initiative !== x.battler.initiative) return y.battler.initiative - x.battler.initiative;
    if (x.side === y.side) return 0;
    return x.side === priorityFirst ? -1 : 1;
  });
  return tagged;
}

/** Posiciones enemigas que ESTE tipo amenaza ahora mismo (ocupadas dentro de su Alcance), y si la
 * linea de tiro al Nucleo esta abierta (nadie propio... digo, nadie RIVAL en su Alcance). Se usa
 * tanto para la mano (donde LA IRIA a amenazar) como para una unidad ya desplegada (a que le
 * apunta este instante). */
function threatPreview(activeType, enemyBoard) {
  const reach = DAMAGE_TYPES[activeType].reach;
  const occupied = reach.filter((p) => enemyBoard[p] && !enemyBoard[p].fallen && !enemyBoard[p].collapsed);
  const nucleoOpen = activeType !== "magic" && occupied.length === 0;
  return { positions: occupied, nucleoOpen };
}

function BoardTile({ battler, highlight, onClick }) {
  const canvasRef = useRef(null);
  const battlerRef = useRef(battler);
  battlerRef.current = battler;

  useEffect(() => {
    if (!battler || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const getBrokenZones = () => {
      const b = battlerRef.current;
      if (!b) return [];
      return Object.keys(b.zones).filter((z) => b.zones[z].integrity <= 0);
    };
    const cleanup = mountBoardToken(canvas, battler.card, getBrokenZones);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battler?.card.code]);

  const classes = ["board-tile"];
  if (!battler) classes.push("board-tile--empty");
  if (battler?.fallen || battler?.collapsed) classes.push("board-tile--down");
  if (highlight) classes.push(`board-tile--${highlight}`);

  return (
    <button type="button" className={classes.join(" ")} onClick={onClick} disabled={!battler && !onClick}>
      {battler && (
        <>
          <canvas ref={canvasRef} className="board-tile-canvas" />
          <div className="board-tile-name">{battler.card.identity.name}</div>
          <div className="board-tile-hp">
            <div
              className="board-tile-hp-fill"
              style={{ width: `${Math.max(0, Math.round((battler.zones.torso.integrity / battler.card.zones.torso.integrity) * 100))}%` }}
            />
          </div>
          {battler.fallen && <div className="board-tile-tag board-tile-tag--fallen">Caído</div>}
          {battler.collapsed && !battler.fallen && <div className="board-tile-tag board-tile-tag--collapsed">Colapsado</div>}
        </>
      )}
    </button>
  );
}

function CardSheet({ card, onClose }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    return mountBoardToken(canvas, card);
  }, [card.code]);

  const { combat, zones, identity, generation } = card;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet card-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>{identity.displayName}</h3>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="card-sheet-body">
          <canvas ref={canvasRef} className="card-sheet-canvas" />
          <div className="card-sheet-stats">
            <div>{card.lineage} · {identity.class} · {card.rarity} · Coste {card.cost}</div>
            <div>Fuerza {combat.strength} · Iniciativa {combat.initiative} · Peso {combat.weight}</div>
            <div>{TYPE_LABEL[combat.damageTypeActive]} — estación {combat.station.map((s) => STATION_SYMBOL[s]).join("/")}, alcance {combat.reachCore ? "Núcleo" : combat.reach.map((s) => STATION_SYMBOL[s]).join("/")}</div>
            <div className="card-sheet-zones">
              {Object.entries(zones).map(([z, zd]) => (
                <span key={z} className={zd.integrity <= 0 ? "card-sheet-zone--broken" : ""}>
                  {z}: {zd.integrity}{zd.plate > 0 ? ` (+${zd.plate} placa)` : ""}
                </span>
              ))}
            </div>
            <div className="card-sheet-trait">
              Rasgo: {identity.trait} ({generation.traitTier})
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BoardPrototype({ onBack }) {
  const stateRef = useRef(freshMatch());
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState([]);
  const [winner, setWinner] = useState(null);
  const [selectedHand, setSelectedHand] = useState(null); // indice en hand
  const [inspecting, setInspecting] = useState(null); // { side, position } — para el ghost + ficha
  const [sheetCard, setSheetCard] = useState(null);

  const rerender = () => setTick((n) => n + 1);

  const reroll = () => {
    stateRef.current = freshMatch();
    setLog([]);
    setWinner(null);
    setSelectedHand(null);
    setInspecting(null);
    rerender();
  };

  const deployAt = (position) => {
    const s = stateRef.current;
    if (s.phase !== "deploy" || selectedHand === null || s.boardA[position]) return;
    const card = s.hand[selectedHand];
    if (!DAMAGE_TYPES[card.combat.damageTypeActive].station.includes(position)) return; // no legal aca
    s.boardA[position] = makeBattler(card);
    s.hand = s.hand.filter((_, i) => i !== selectedHand);
    setSelectedHand(null);
    rerender();
  };

  const startBattle = () => {
    stateRef.current.phase = "battle";
    setInspecting(null);
    rerender();
  };

  const step = () => {
    const state = stateRef.current;
    if (winner) return;

    if (state.queue.length === 0) {
      state.round += 1;
      state.queue = buildQueue(state);
      if (state.queue.length === 0) return;
    }

    let entry = state.queue.shift();
    while (entry && (entry.battler.fallen || entry.battler.collapsed)) entry = state.queue.shift();
    if (!entry) {
      rerender();
      return;
    }

    const { battler, side } = entry;
    const defBoard = side === "A" ? state.boardB : state.boardA;
    const defNucleo = side === "A" ? state.nucleoB : state.nucleoA;
    const result = resolveAttack(battler, defBoard, defNucleo);

    let line = `${battler.card.identity.name}: `;
    if (result.kind === "no_target") line += "sin objetivo.";
    else if (result.kind === "no_magic_head_broken") line += "no puede lanzar Magic (cabeza rota).";
    else if (result.kind === "hit_nucleo") line += `impacta el Núcleo rival por ${result.dmg}.`;
    else {
      const defender = defBoard[result.position];
      line += `golpea a ${defender.card.identity.name} (${result.zones.join(" + ")})`;
      if (result.plateChipped) line += " — rompe placa";
      if (result.integrityDamage > 0) line += ` — ${result.integrityDamage} de daño`;
      if (result.fell) line += " — ¡cae!";
      line += ".";
    }
    setLog((prev) => [...prev.slice(-7), line]);

    if (state.queue.length === 0) {
      for (const p of POSITIONS) {
        if (state.boardA[p] && checkCollapse(state.boardA[p])) setLog((prev) => [...prev.slice(-7), `${state.boardA[p].card.identity.name} colapsa.`]);
        if (state.boardB[p] && checkCollapse(state.boardB[p])) setLog((prev) => [...prev.slice(-7), `${state.boardB[p].card.identity.name} colapsa.`]);
      }
    }

    if (state.nucleoA.hp <= 0) setWinner("B");
    else if (state.nucleoB.hp <= 0) setWinner("A");

    rerender();
  };

  const s = stateRef.current;

  // La "capa transparente": de la carta de mano seleccionada, O de la unidad ya desplegada que se
  // esta inspeccionando — cual de las dos manda cuando ambas podrian coexistir no pasa, se
  // excluyen entre si (elegir una carta de mano cierra la inspeccion y viceversa).
  const handCard = selectedHand !== null ? s.hand[selectedHand] : null;
  const inspectedBattler = inspecting ? (inspecting.side === "A" ? s.boardA : s.boardB)[inspecting.position] : null;
  const activeType = handCard?.combat.damageTypeActive || inspectedBattler?.activeType;
  const legalOwnPositions = handCard ? DAMAGE_TYPES[handCard.combat.damageTypeActive].station : null;
  const threat = activeType
    ? threatPreview(activeType, inspectedBattler && inspecting.side === "B" ? s.boardA : s.boardB)
    : null;

  const tileHighlight = (side, position) => {
    if (side === "A" && legalOwnPositions) {
      return legalOwnPositions.includes(position) && !s.boardA[position] ? "legal" : s.boardA[position] ? null : "illegal";
    }
    if (threat && ((inspectedBattler ? inspecting.side !== side : side === "B"))) {
      return threat.positions.includes(position) ? "threatened" : null;
    }
    return null;
  };

  return (
    <div className="board-proto">
      <div className={`board-proto-nucleo${threat?.nucleoOpen ? " board-proto-nucleo--alert" : ""}`}>
        <span>Núcleo rival: {s.nucleoB.hp}/{NUCLEO_BASE}</span>
        <span>{s.phase === "deploy" ? "Desplegando" : `Ronda ${s.round}`}</span>
        <span>Núcleo propio: {s.nucleoA.hp}/{NUCLEO_BASE}</span>
      </div>

      <div className="board-grid-row">
        {POSITIONS.map((p) => (
          <BoardTile
            key={`b${p}`}
            battler={s.boardB[p]}
            highlight={tileHighlight("B", p)}
            onClick={s.boardB[p] ? () => { setSelectedHand(null); setInspecting({ side: "B", position: p }); } : null}
          />
        ))}
      </div>
      <div className="board-divider"><span>VS</span></div>
      <div className="board-grid-row">
        {POSITIONS.map((p) => (
          <BoardTile
            key={`a${p}`}
            battler={s.boardA[p]}
            highlight={tileHighlight("A", p)}
            onClick={
              s.boardA[p]
                ? () => { setSelectedHand(null); setInspecting({ side: "A", position: p }); }
                : s.phase === "deploy" && selectedHand !== null
                  ? () => deployAt(p)
                  : null
            }
          />
        ))}
      </div>

      {(handCard || inspectedBattler) && (
        <div className="board-proto-selection">
          <span>
            {handCard ? `${handCard.identity.name} (${TYPE_LABEL[handCard.combat.damageTypeActive]})` : `${inspectedBattler.card.identity.name} (${TYPE_LABEL[inspectedBattler.activeType]})`}
            {threat?.nucleoOpen && " — ¡línea abierta al Núcleo!"}
          </span>
          <button
            type="button"
            className="board-proto-selection-btn"
            onClick={() => setSheetCard(handCard || inspectedBattler.card)}
          >
            Ver ficha
          </button>
        </div>
      )}

      {s.phase === "deploy" ? (
        <div className="board-hand pixel-scroll">
          {s.hand.length === 0 && <div className="board-hand-empty">Mano vacía.</div>}
          {s.hand.map((card, i) => (
            <button
              key={card.code}
              type="button"
              className={`board-hand-card${i === selectedHand ? " board-hand-card--selected" : ""}`}
              onClick={() => { setInspecting(null); setSelectedHand(i === selectedHand ? null : i); }}
            >
              <span className="board-hand-card-cost">{card.cost}</span>
              <span className="board-hand-card-name">{card.identity.name}</span>
              <span className="board-hand-card-type">{TYPE_LABEL[card.combat.damageTypeActive]}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="board-proto-log pixel-scroll">
          {log.length === 0 && <div className="board-proto-log-line">Tocá "Siguiente golpe" para arrancar.</div>}
          {log.map((line, i) => <div key={i} className="board-proto-log-line">{line}</div>)}
          {winner && <div className="board-proto-log-line board-proto-log-line--winner">{winner === "A" ? "¡Ganaste!" : "Ganó el rival."}</div>}
        </div>
      )}

      <div className="board-proto-actions">
        {s.phase === "deploy" ? (
          <button type="button" className="scan-again" onClick={startBattle} disabled={POSITIONS.every((p) => !s.boardA[p])}>
            Comenzar batalla
          </button>
        ) : (
          <button type="button" className="scan-again" onClick={step} disabled={!!winner}>
            Siguiente golpe
          </button>
        )}
        <button type="button" className="scan-again scan-again--secondary" onClick={reroll}>
          🎲 Nueva partida
        </button>
      </div>

      <button type="button" className="scan-again scan-again--secondary board-proto-back" onClick={onBack}>
        Volver
      </button>

      {sheetCard && <CardSheet card={sheetCard} onClose={() => setSheetCard(null)} />}
    </div>
  );
}
