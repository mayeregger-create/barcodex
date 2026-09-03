// src/combat/simulate.js
// Orquesta una partida completa entre 2 mazos ya generados (doc §10.2, acotado — ver board.js
// para que queda explicitamente afuera de esta primera pasada). Despliegue simplificado: cada
// lado arranca con hasta 3 en el tablero (autoDeploy) y el resto en Reserva; cuando un casillero
// queda libre (Caidos), un suplente de Reserva lo ocupa al empezar la ronda siguiente — aproxima
// la Fase 3 real (el despliegue pasa TODAS las rondas) sin modelar Impulso/Coste/mano todavia.
import { autoDeploy, aliveBattlers, backfillFromReserve, NUCLEO_BASE, POSITIONS } from "./board.js";
import { resolveAttack, checkCollapse, applyPostAttackTraits } from "./resolve.js";
import { hasTrait } from "./traits.js";

/** Frenetico (raro): "actua dos veces por ronda" — se modela dandole una SEGUNDA entrada en la
 * cola de turno (no un segundo golpe dentro de la misma entrada, eso es Gemelo — ver
 * turnResolution.js). Al tener la misma Iniciativa, el orden normal las deja adyacentes la
 * enorme mayoria de las veces; cada entrada dispara UN resolveTurn(), y turnResolution.js sabe
 * aplicarle la mitad de Fuerza a cada una. */
function taggedWithFrenetico(board, side) {
  const tagged = [];
  for (const b of aliveBattlers(board)) {
    tagged.push({ battler: b, side });
    if (hasTrait(b, "frenetico")) tagged.push({ battler: b, side });
  }
  return tagged;
}

/** Fulminante (raro) siempre va primero, Paciente (raro) siempre va ultimo — ambos ganan a la
 * Iniciativa, que solo desempata entre battlers "normales" (o entre 2 Fulminantes, o entre 2
 * Pacientes). Doc de cada rasgo: Fulminante "actua antes que cualquier otra unidad del tablero",
 * Paciente "actua siempre ultimo" (su contrapartida por acumular Fuerza, ver resolve.js). */
export function buildTurnOrder(boardA, boardB, priorityFirst) {
  const tagged = [...taggedWithFrenetico(boardA, "A"), ...taggedWithFrenetico(boardB, "B")];
  tagged.sort((x, y) => {
    const fx = hasTrait(x.battler, "fulminante") ? 1 : 0;
    const fy = hasTrait(y.battler, "fulminante") ? 1 : 0;
    if (fx !== fy) return fy - fx;
    const px = hasTrait(x.battler, "paciente") ? 1 : 0;
    const py = hasTrait(y.battler, "paciente") ? 1 : 0;
    if (px !== py) return px - py;
    if (y.battler.initiative !== x.battler.initiative) return y.battler.initiative - x.battler.initiative;
    if (x.side === y.side) return 0;
    return x.side === priorityFirst ? -1 : 1; // empate: actua primero el lado con prioridad
  });
  return tagged;
}

/** Saca del tablero a quien cayo o colapso esta ronda y lo manda al cementerio de stats — libera
 * el casillero para que backfillFromReserve lo pueda ocupar. */
function clearFallenSlots(board, graveyard) {
  for (const p of POSITIONS) {
    const b = board[p];
    if (b && (b.fallen || b.collapsed)) {
      graveyard.push(b);
      board[p] = null;
    }
  }
}

/**
 * @param {object[]} cardsA - cartas generadas (cardgen/card.js#generateCard) del lado A.
 * @param {object[]} cardsB - idem lado B.
 * @param {{ maxRounds?: number, lineOfSight?: boolean }} [opts] - lineOfSight default true: la
 *   regla real de exposicion del Nucleo (por tipo, segun su propio Alcance) — reemplaza al
 *   "tablero 100% limpio" del doc original. Se verifico en el simulador que la regla vieja
 *   trababa el 45% de las partidas en empate (nunca resuelven) contra 1.2% con esta. false queda
 *   solo para poder seguir comparando ambas si hace falta.
 */
export function simulateMatch(cardsA, cardsB, { maxRounds = 40, lineOfSight = true } = {}) {
  const { board: boardA, undeployed: reserveA } = autoDeploy(cardsA);
  const { board: boardB, undeployed: reserveB } = autoDeploy(cardsB);
  const graveyardA = [];
  const graveyardB = [];
  const nucleoA = { hp: NUCLEO_BASE };
  const nucleoB = { hp: NUCLEO_BASE };

  const log = [];
  const stats = {
    torsoBreaks: 0,
    collapses: 0,
    byType: {
      // trueWaste = ni dano de Integridad NI progreso de Placa (un golpe realmente en el aire).
      // plateChipped = rompio 1 de Placa (Cut/Blunt contra placa) — exito real, no desperdicio,
      // aunque ese golpe en particular no haya tocado Integridad (ver resolve.js#hitZone).
      pierce: { attacks: 0, trueWaste: 0, plateChipped: 0, noTarget: 0 },
      cut: { attacks: 0, trueWaste: 0, plateChipped: 0, noTarget: 0 },
      blunt: { attacks: 0, trueWaste: 0, plateChipped: 0, noTarget: 0 },
      magic: { attacks: 0, trueWaste: 0, plateChipped: 0, noTarget: 0 },
    },
    // Golpes necesarios para romper cada zona (solo zonas que llegaron a romperse en esta
    // partida) — para el pendiente §17.3 ("duracion del torso").
    hitsToBreakByZone: { head: [], torso: [], armMain: [], armOff: [], legs: [] },
  };

  let round = 0;
  let winner = null;

  while (round < maxRounds) {
    round += 1;
    backfillFromReserve(boardA, reserveA);
    backfillFromReserve(boardB, reserveB);

    const priorityFirst = round % 2 === 1 ? "A" : "B";
    const order = buildTurnOrder(boardA, boardB, priorityFirst);

    for (const { battler, side } of order) {
      if (battler.fallen || battler.collapsed) continue; // pudo caer mas temprano esta misma ronda

      const defBoard = side === "A" ? boardB : boardA;
      const defNucleo = side === "A" ? nucleoB : nucleoA;
      const typeStats = stats.byType[battler.activeType];

      const result = resolveAttack(battler, defBoard, defNucleo, lineOfSight);
      applyPostAttackTraits(battler, result);

      if (result.kind === "no_target" || result.kind === "no_magic_head_broken") {
        typeStats.noTarget += 1;
      } else {
        typeStats.attacks += 1;
        if (result.kind === "hit_unit") {
          if (result.trueWaste) typeStats.trueWaste += 1;
          if (result.plateChipped) typeStats.plateChipped += 1;
          if (result.fell) stats.torsoBreaks += 1;
        }
      }

      log.push({ round, side, card: battler.card.identity.displayName, ...result });

      if (nucleoA.hp <= 0) {
        winner = "B";
        break;
      }
      if (nucleoB.hp <= 0) {
        winner = "A";
        break;
      }
    }

    if (winner) break;

    // Fase 5 — Colapso, despues liberar casilleros para la Reserva de la proxima ronda.
    for (const b of aliveBattlers(boardA)) if (checkCollapse(b)) stats.collapses += 1;
    for (const b of aliveBattlers(boardB)) if (checkCollapse(b)) stats.collapses += 1;
    clearFallenSlots(boardA, graveyardA);
    clearFallenSlots(boardB, graveyardB);
  }

  if (!winner) {
    // Se agoto maxRounds sin que ningun Nucleo llegara a 0 — desempate por HP restante, para que
    // las estadisticas agregadas de muchas partidas no descarten estos casos.
    winner = nucleoA.hp === nucleoB.hp ? "draw" : nucleoA.hp > nucleoB.hp ? "A" : "B";
  }

  for (const battlers of [Object.values(boardA), Object.values(boardB), graveyardA, graveyardB]) {
    for (const b of battlers) {
      if (!b) continue;
      for (const zoneName of Object.keys(b.zones)) {
        const zone = b.zones[zoneName];
        if (zone.broken && zone.hitsToBreak) stats.hitsToBreakByZone[zoneName].push(zone.hitsToBreak);
      }
    }
  }

  return {
    winner,
    rounds: round,
    nucleoA: nucleoA.hp,
    nucleoB: nucleoB.hp,
    survivorsA: aliveBattlers(boardA).length,
    survivorsB: aliveBattlers(boardB).length,
    stats,
    log,
  };
}
