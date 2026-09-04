// src/components/BoardPrototype.jsx
// Prototipo de la grilla cenital (ver chat: "puntos de vista") + la idea central del sistema
// nuevo hecha visible de verdad — cuando una zona se rompe, la pieza de Titiritero se desprende y
// queda colgando del remache en vivo (gameZones.js), no una barra de vida abstracta. Motor de
// combate REAL (src/combat/), avanzado a mano un golpe a la vez para poder mirarlo.
//
// Ronda continua, no "arma todo tu mazo y despues mira": cada ronda tiene una ventana de
// despliegue (fase "deploy" — tu Impulso decide cuanto podes comprometer de la mano) seguida de
// la resolucion golpe a golpe (fase "battle"), y al vaciarse la cola se abre la ventana de la
// siguiente ronda sola. El Regente arranca ya desplegado gratis (economy.js#pickRegente), el
// rival se autogestiona su propia mano con la misma heuristica greedy del simulador headless.
import { useEffect, useRef, useState } from "react";
import { generateCard } from "../cardgen/card.js";
import { makeBattler, placeCard, backfillFromReserve, resetRoundFlags, legalStationFor, POSITIONS, NUCLEO_BASE } from "../combat/board.js";
import { checkCollapse } from "../combat/resolve.js";
import { buildTurnOrder } from "../combat/simulate.js";
import { resolveTurn, applyCollapseTraits } from "../combat/turnResolution.js";
import { tryReparar, REPARAR_COST } from "../combat/nucleoAbilities.js";
import { isColosalGrounded } from "../combat/traits.js";
import {
  gainImpulso,
  escombrosFromDeploy,
  effectiveDeployCost,
  resolveBattlerLoss,
  pickRegente,
  nucleoBonusFromRegente,
  commitFromHand,
  IMPULSO_START,
  IMPULSO_CAP,
  NUCLEO_SHIELD_ROUNDS,
} from "../combat/economy.js";
import { DAMAGE_TYPES } from "../cardgen/classGen.js";
import { mountBoardToken } from "../titiritero/index.js";

const DECK_SIZE = 5; // 1 se vuelve Regente (gratis, ronda 1) + 4 quedan en la mano
const TYPE_LABEL = { pierce: "Pierce", cut: "Cut", blunt: "Blunt", magic: "Magic" };
const STATION_SYMBOL = { 1: "1", 2: "2", 3: "3" };

function randomCode13() {
  let d = "";
  for (let i = 0; i < 13; i++) d += Math.floor(Math.random() * 10);
  return d;
}

/** Arranca la siguiente ronda sobre un estado ya existente: sube el Impulso de ambos lados, deja
 * que el rival comprometa lo que le alcance de su mano (misma heuristica que economy.js#commitFromHand),
 * rellena huecos desde la Reserva de los dos bandos (gratis) y abre la ventana de despliegue del
 * jugador. Muta `state` en el lugar — no devuelve nada. */
function beginRound(state) {
  state.round += 1;
  state.impulsoA = gainImpulso(state.impulsoA);
  state.impulsoB = gainImpulso(state.impulsoB);
  resetRoundFlags(state.boardA); // rasgo "reflejo": vuelve a estar disponible cada ronda
  resetRoundFlags(state.boardB);

  const resB = commitFromHand(state.handB, state.impulsoB, state.regenteB.identity.class); // "leal"
  state.handB = resB.hand;
  state.impulsoB = resB.impulsoLeft;
  for (const card of resB.committed) {
    placeCard(card, state.boardB, state.reserveB);
    state.escombros.B += escombrosFromDeploy(card); // "abastecedor"
  }

  backfillFromReserve(state.boardA, state.reserveA);
  backfillFromReserve(state.boardB, state.reserveB);

  // Habilidad de Nucleo (Reparar, 2 Escombros): el rival la usa apenas puede pagarla.
  tryReparar(state.boardB, state.escombros, "B");

  state.phase = "deploy";
  state.queue = [];
}

function freshMatch() {
  const deckA = Array.from({ length: DECK_SIZE }, () => generateCard(randomCode13()));
  const deckB = Array.from({ length: DECK_SIZE }, () => generateCard(randomCode13()));
  const { regente: regenteA, hand: handA } = pickRegente(deckA);
  const { regente: regenteB, hand: handB } = pickRegente(deckB);

  const boardA = { 1: null, 2: null, 3: null };
  const boardB = { 1: null, 2: null, 3: null };
  const reserveA = [];
  const reserveB = [];
  placeCard(regenteA, boardA, reserveA);
  placeCard(regenteB, boardB, reserveB);

  const state = {
    phase: "deploy",
    round: 0,
    regenteA,
    regenteB,
    handA,
    handB,
    boardA,
    boardB,
    reserveA,
    reserveB,
    nucleoA: { hp: NUCLEO_BASE + nucleoBonusFromRegente(regenteA) },
    nucleoB: { hp: NUCLEO_BASE + nucleoBonusFromRegente(regenteB) },
    impulsoA: IMPULSO_START,
    impulsoB: IMPULSO_START,
    escombros: { A: escombrosFromDeploy(regenteA), B: escombrosFromDeploy(regenteB) },
    queue: [],
  };
  beginRound(state);
  return state;
}

/** Wrapper fino sobre buildTurnOrder (simulate.js) — comparte la logica de orden (incluida la de
 * Fulminante/Paciente) con el simulador headless en vez de mantener una copia local que se puede
 * desincronizar. */
function buildQueue(state) {
  const priorityFirst = state.round % 2 === 1 ? "A" : "B";
  return buildTurnOrder(state.boardA, state.boardB, priorityFirst);
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
  const [selectedHand, setSelectedHand] = useState(null); // indice en handA
  const [inspecting, setInspecting] = useState(null); // { side, position } — para el ghost + ficha
  const [sheetCard, setSheetCard] = useState(null);

  const rerender = () => setTick((n) => n + 1);
  const pushLog = (line) => setLog((prev) => [...prev.slice(-7), line]);

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
    const card = s.handA[selectedHand];
    if (!legalStationFor(card).includes(position)) return; // no legal aca
    const cost = effectiveDeployCost(card, s.regenteA.identity.class); // "leal": -2 si comparte Clase con el Regente
    if (cost > s.impulsoA) return; // no alcanza el Impulso de esta ronda
    s.boardA[position] = makeBattler(card);
    s.impulsoA -= cost;
    s.escombros.A += escombrosFromDeploy(card); // "abastecedor"
    s.handA = s.handA.filter((_, i) => i !== selectedHand);
    setSelectedHand(null);
    rerender();
  };

  /** Cuando la carta seleccionada es legal pero las posiciones de su Estacion ya estan ocupadas —
   * se compromete igual (paga Impulso) y espera en Reserva a que se abra un lugar, gratis, en una
   * ronda futura (mismo backfillFromReserve que usa el rival). */
  const commitToReserve = () => {
    const s = stateRef.current;
    if (s.phase !== "deploy" || selectedHand === null) return;
    const card = s.handA[selectedHand];
    const cost = effectiveDeployCost(card, s.regenteA.identity.class);
    if (cost > s.impulsoA) return;
    s.reserveA.push(card);
    s.impulsoA -= cost;
    s.escombros.A += escombrosFromDeploy(card);
    s.handA = s.handA.filter((_, i) => i !== selectedHand);
    setSelectedHand(null);
    rerender();
  };

  /** Habilidad de Nucleo: repara 1 de Integridad a la zona propia mas dañada por 2 Escombros. */
  const useReparar = () => {
    const s = stateRef.current;
    if (s.phase !== "deploy") return;
    tryReparar(s.boardA, s.escombros, "A");
    rerender();
  };

  const resolveRound = () => {
    const s = stateRef.current;
    s.phase = "battle";
    s.queue = buildQueue(s);
    setInspecting(null);
    rerender();
  };

  const step = () => {
    if (winner) return;
    const state = stateRef.current;

    if (state.queue.length === 0) {
      // Fase 5 de esta ronda: Colapso, despues liberar casilleros y cobrar Escombros — y si nadie
      // gano todavia, abrir la ventana de despliegue de la ronda que sigue.
      for (const p of POSITIONS) {
        if (state.boardA[p] && checkCollapse(state.boardA[p])) {
          pushLog(`${state.boardA[p].card.identity.name} colapsa.`);
          applyCollapseTraits(state.boardA[p], state.boardA);
        }
        if (state.boardB[p] && checkCollapse(state.boardB[p])) {
          pushLog(`${state.boardB[p].card.identity.name} colapsa.`);
          applyCollapseTraits(state.boardB[p], state.boardB);
        }
      }
      // economy.js#resolveBattlerLoss decide Renaciente (vuelve a la mano) vs. Escombros normales
      // (con el triple de Legado solo si fue un Colapso real, no una muerte por torso roto).
      for (const [board, sideKey, hand] of [[state.boardA, "A", state.handA], [state.boardB, "B", state.handB]]) {
        for (const p of POSITIONS) {
          const b = board[p];
          if (b && (b.fallen || b.collapsed)) {
            const { returnedToHand, escombrosGained } = resolveBattlerLoss(b);
            if (returnedToHand) {
              hand.push(b.card);
              pushLog(`${b.card.identity.name} colapsa y vuelve a la mano de ${sideKey === "A" ? "tu" : "el rival"}.`);
            } else {
              state.escombros[sideKey] += escombrosGained;
            }
            board[p] = null;
          }
        }
      }
      beginRound(state);
      setSelectedHand(null);
      pushLog(`— Ronda ${state.round} —`);
      rerender();
      return;
    }

    let entry = state.queue.shift();
    while (entry) {
      if (entry.battler.fallen || entry.battler.collapsed) { entry = state.queue.shift(); continue; }
      // Colosal: "no actua la ronda en que se despliega" — a diferencia de fallen/collapsed (obvio
      // en el tablero), esto no es evidente para el jugador, asi que se loguea.
      if (isColosalGrounded(entry.battler)) {
        pushLog(`${entry.battler.card.identity.name}: recién desplegado (Colosal), no actúa esta ronda.`);
        entry = state.queue.shift();
        continue;
      }
      break;
    }
    if (!entry) {
      rerender();
      return;
    }

    const { battler, side } = entry;
    const defBoard = side === "A" ? state.boardB : state.boardA;
    const defNucleo = side === "A" ? state.nucleoB : state.nucleoA;
    const ownBoard = side === "A" ? state.boardA : state.boardB;

    // resolveTurn (turnResolution.js) hace todo el ritual del turno: salida de Magic por Linaje,
    // aura de Estandarte, Paciente/Sereno post-golpe, y repite el golpe si aplica Gemelo/Implacable
    // — devuelve un golpe, o varios en esos casos.
    const results = resolveTurn(battler, side, {
      ownBoard,
      defBoard,
      defNucleo,
      escombros: state.escombros,
      getImpulso: () => (side === "A" ? state.impulsoA : state.impulsoB),
      spendImpulso: (n) => { if (side === "A") state.impulsoA -= n; else state.impulsoB -= n; },
      round: state.round,
      nucleoShieldRounds: NUCLEO_SHIELD_ROUNDS,
      lineOfSight: true,
    });

    for (const result of results) {
      let line = `${battler.card.identity.name}: `;
      if (result.kind === "no_target") line += "sin objetivo.";
      else if (result.kind === "no_magic_head_broken") line += "no puede lanzar Magic (cabeza rota).";
      else if (result.kind === "nucleo_shielded") line += "el escudo del Núcleo absorbe el golpe.";
      else if (result.kind === "dodged") line += `${defBoard[result.position].card.identity.name} esquiva.`;
      else if (result.kind === "immune") line += `${defBoard[result.position].card.identity.name} es inmune (palíndromo).`;
      else if (result.kind === "hit_nucleo") line += `impacta el Núcleo rival por ${result.dmg}.`;
      else {
        const defender = defBoard[result.position];
        line += `golpea a ${defender.card.identity.name} (${result.zones.join(" + ")})`;
        if (result.plateChipped) line += " — rompe placa";
        if (result.integrityDamage > 0) line += ` — ${result.integrityDamage} de daño`;
        if (result.fell) line += " — ¡cae!";
        if (result.igneoSpread) line += " — el fuego se propaga";
        line += ".";
      }
      pushLog(line);
    }

    if (state.nucleoA.hp <= 0) setWinner("B");
    else if (state.nucleoB.hp <= 0) setWinner("A");

    rerender();
  };

  const s = stateRef.current;
  const shielded = s.round <= NUCLEO_SHIELD_ROUNDS;

  // La "capa transparente": de la carta de mano seleccionada, O de la unidad ya desplegada que se
  // esta inspeccionando — cual de las dos manda cuando ambas podrian coexistir no pasa, se
  // excluyen entre si (elegir una carta de mano cierra la inspeccion y viceversa).
  const handCard = selectedHand !== null ? s.handA[selectedHand] : null;
  const handCardCost = handCard ? effectiveDeployCost(handCard, s.regenteA.identity.class) : null;
  const affordable = handCard ? handCardCost <= s.impulsoA : true;
  const inspectedBattler = inspecting ? (inspecting.side === "A" ? s.boardA : s.boardB)[inspecting.position] : null;
  const activeType = handCard?.combat.damageTypeActive || inspectedBattler?.activeType;
  const legalOwnPositions = handCard && affordable ? legalStationFor(handCard) : handCard ? [] : null;
  const hasEmptyLegalSlot = legalOwnPositions ? legalOwnPositions.some((p) => !s.boardA[p]) : false;
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
        <span>Núcleo rival: {s.nucleoB.hp}{shielded ? " 🛡" : ""}</span>
        <span>{s.phase === "deploy" ? `Ronda ${s.round} — desplegando` : `Ronda ${s.round} — resolviendo`}</span>
        <span>Núcleo propio: {s.nucleoA.hp}{shielded ? " 🛡" : ""}</span>
      </div>

      <div className="board-proto-resources">
        <span>Impulso: {s.impulsoA}/{IMPULSO_CAP}</span>
        <span>Escombros: {s.escombros.A}</span>
        {s.reserveA.length > 0 && <span>Reserva: {s.reserveA.length}</span>}
        {s.phase === "deploy" && (
          <button
            type="button"
            className="board-proto-reparar-btn"
            onClick={useReparar}
            disabled={s.escombros.A < REPARAR_COST}
          >
            Reparar ({REPARAR_COST})
          </button>
        )}
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
            {handCard
              ? `${handCard.identity.name} (${TYPE_LABEL[handCard.combat.damageTypeActive]}) · Coste ${handCardCost}${handCardCost !== handCard.cost ? ` (leal, antes ${handCard.cost})` : ""}`
              : `${inspectedBattler.card.identity.name} (${TYPE_LABEL[inspectedBattler.activeType]})`}
            {threat?.nucleoOpen && " — ¡línea abierta al Núcleo!"}
            {handCard && !affordable && " — no alcanza el Impulso"}
          </span>
          <span className="board-proto-selection-actions">
            {handCard && affordable && !hasEmptyLegalSlot && (
              <button type="button" className="board-proto-selection-btn" onClick={commitToReserve}>
                A Reserva
              </button>
            )}
            <button
              type="button"
              className="board-proto-selection-btn"
              onClick={() => setSheetCard(handCard || inspectedBattler.card)}
            >
              Ver ficha
            </button>
          </span>
        </div>
      )}

      {s.phase === "deploy" ? (
        <div className="board-hand pixel-scroll">
          {s.handA.length === 0 && <div className="board-hand-empty">Mano vacía.</div>}
          {s.handA.map((card, i) => {
            const cost = effectiveDeployCost(card, s.regenteA.identity.class);
            return (
              <button
                key={card.code}
                type="button"
                className={`board-hand-card${i === selectedHand ? " board-hand-card--selected" : ""}${cost > s.impulsoA ? " board-hand-card--unaffordable" : ""}`}
                onClick={() => { setInspecting(null); setSelectedHand(i === selectedHand ? null : i); }}
              >
                <span className="board-hand-card-cost">{cost}</span>
                <span className="board-hand-card-name">{card.identity.name}</span>
                <span className="board-hand-card-type">{TYPE_LABEL[card.combat.damageTypeActive]}</span>
              </button>
            );
          })}
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
          <button type="button" className="scan-again" onClick={resolveRound}>
            Resolver ronda →
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
