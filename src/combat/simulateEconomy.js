// src/combat/simulateEconomy.js
// Igual que simulate.js (mismo motor de combate, resolveAttack/checkCollapse sin tocar) pero con
// Impulso/Escombros/Regente reales en vez de desplegar el mazo entero de arranque — pasada
// separada a proposito, para poder seguir comparando contra el baseline sin economia si hace
// falta. Ver economy.js para las decisiones de diseno de cada recurso.
import { placeCard, aliveBattlers, backfillFromReserve, resetRoundFlags, NUCLEO_BASE, POSITIONS } from "./board.js";
import { checkCollapse } from "./resolve.js";
import { buildTurnOrder } from "./simulate.js";
import { resolveTurn, applyCollapseTraits } from "./turnResolution.js";
import { isColosalGrounded } from "./traits.js";
import {
  gainImpulso,
  escombrosFromDeploy,
  resolveBattlerLoss,
  pickRegente,
  nucleoBonusFromRegente,
  commitFromHand,
  IMPULSO_START,
  NUCLEO_SHIELD_ROUNDS,
} from "./economy.js";
import { tryReparar } from "./nucleoAbilities.js";

/** `hand` recibe de vuelta las cartas de Renaciente en vez de ir a `graveyard` — el llamador debe
 * reasignar su variable de mano al array devuelto por `commitFromHand` la RONDA SIGUIENTE, asi que
 * empujar aca (mutando el mismo array que ya referencia esa variable) alcanza sin devolver nada
 * nuevo. Ver economy.js#resolveBattlerLoss para la logica de Renaciente/Legado en si. */
function clearFallenSlots(board, graveyard, escombros, sideKey, hand) {
  for (const p of POSITIONS) {
    const b = board[p];
    if (b && (b.fallen || b.collapsed)) {
      const { returnedToHand, escombrosGained } = resolveBattlerLoss(b);
      if (returnedToHand) hand.push(b.card);
      else {
        graveyard.push(b);
        escombros[sideKey] += escombrosGained;
      }
      board[p] = null;
    }
  }
}

/**
 * @param {object[]} deckA - mazo completo del lado A (cartas generadas, incluye al futuro Regente).
 * @param {object[]} deckB - idem lado B.
 * @param {{ maxRounds?: number, graceRounds?: number, nucleoShieldRounds?: number }} [opts]
 *   - nucleoShieldRounds (default 3, ADOPTADO): mientras `round <= nucleoShieldRounds`, CUALQUIER
 *     golpe que hubiera llegado al Nucleo (por la regla que este activa, linea de tiro incluida)
 *     simplemente no le hace nada — el Nucleo es inatacable esas rondas. Resuelve que el tablero
 *     disperso de la economia (solo el Regente en ronda 1) reabria la exposicion de Nucleo que
 *     linea de tiro ya habia resuelto: sin esto, las partidas con economia terminaban MAS RAPIDO
 *     que el baseline (6.5 vs 8.2 rondas) porque varios carriles quedaban abiertos a la vez desde
 *     el arranque. Verificado en el chat: con el escudo, la duracion vuelve a 8.0-8.1 rondas y 0
 *     golpes reales al Nucleo en las rondas protegidas (garantia dura). Magic paga igual su costo
 *     de cabeza durante el escudo — protege al Nucleo, no vuelve gratis el hechizo.
 *   - graceRounds (default 0, NO adoptado): alternativa descartada — en vez de bloquear el golpe,
 *     aflojaba la regla de exposicion al §2.2 original (tablero 100% vacio) por unas rondas; daba
 *     un resultado agregado similar pero sin garantia dura (126 golpes reales se colaban igual en
 *     2000 partidas de prueba). Se deja en el codigo solo por si hace falta comparar de nuevo.
 */
export function simulateMatchWithEconomy(deckA, deckB, { maxRounds = 60, graceRounds = 0, nucleoShieldRounds = NUCLEO_SHIELD_ROUNDS } = {}) {
  const { regente: regenteA, hand: handAInit } = pickRegente(deckA);
  const { regente: regenteB, hand: handBInit } = pickRegente(deckB);

  const boardA = { 1: null, 2: null, 3: null };
  const boardB = { 1: null, 2: null, 3: null };
  const reserveA = [];
  const reserveB = [];
  let handA = [...handAInit];
  let handB = [...handBInit];

  placeCard(regenteA, boardA, reserveA);
  placeCard(regenteB, boardB, reserveB);

  const graveyardA = [];
  const graveyardB = [];
  const nucleoA = { hp: NUCLEO_BASE + nucleoBonusFromRegente(regenteA) };
  const nucleoB = { hp: NUCLEO_BASE + nucleoBonusFromRegente(regenteB) };

  let impulsoA = IMPULSO_START;
  let impulsoB = IMPULSO_START;
  const escombros = { A: escombrosFromDeploy(regenteA), B: escombrosFromDeploy(regenteB) };

  const stats = {
    impulsoSpent: { A: 0, B: 0 },
    impulsoLeftoverSum: { A: 0, B: 0 }, // para el promedio de cuanto Impulso queda sin gastar cada ronda ("eficiencia de curva")
    secondUnitRound: { A: null, B: null }, // primera ronda en que se comprometio una carta de mano (el Regente no cuenta, ya esta en ronda 1)
    boardFullRound: { A: null, B: null },
    handEmptyRound: { A: null, B: null },
    torsoBreaks: 0,
    collapses: 0,
    magicFallback: { attempts: 0, ok: 0, failed: 0, byKind: {} }, // uso real de la salida de Magic por Linaje
    repararUsed: { A: 0, B: 0 }, // cuantas veces cada bando pudo pagar la habilidad de Nucleo
  };

  const log = [];
  let round = 0;
  let winner = null;

  while (round < maxRounds) {
    round += 1;

    // Fase 0/1 — economia + refuerzos
    impulsoA = gainImpulso(impulsoA);
    impulsoB = gainImpulso(impulsoB);
    resetRoundFlags(boardA); // rasgo "reflejo": vuelve a estar disponible cada ronda
    resetRoundFlags(boardB);

    const resA = commitFromHand(handA, impulsoA, regenteA.identity.class); // "leal": descuento si comparte Clase con el Regente
    handA = resA.hand;
    impulsoA = resA.impulsoLeft;
    stats.impulsoSpent.A += resA.impulsoSpent;
    stats.impulsoLeftoverSum.A += impulsoA;
    for (const card of resA.committed) {
      placeCard(card, boardA, reserveA);
      escombros.A += escombrosFromDeploy(card); // "abastecedor"
    }
    if (stats.secondUnitRound.A === null && resA.committed.length > 0) stats.secondUnitRound.A = round;
    if (stats.handEmptyRound.A === null && handA.length === 0) stats.handEmptyRound.A = round;

    const resB = commitFromHand(handB, impulsoB, regenteB.identity.class);
    handB = resB.hand;
    impulsoB = resB.impulsoLeft;
    stats.impulsoSpent.B += resB.impulsoSpent;
    stats.impulsoLeftoverSum.B += impulsoB;
    for (const card of resB.committed) {
      placeCard(card, boardB, reserveB);
      escombros.B += escombrosFromDeploy(card);
    }
    if (stats.secondUnitRound.B === null && resB.committed.length > 0) stats.secondUnitRound.B = round;
    if (stats.handEmptyRound.B === null && handB.length === 0) stats.handEmptyRound.B = round;

    backfillFromReserve(boardA, reserveA);
    backfillFromReserve(boardB, reserveB);

    if (stats.boardFullRound.A === null && POSITIONS.every((p) => boardA[p])) stats.boardFullRound.A = round;
    if (stats.boardFullRound.B === null && POSITIONS.every((p) => boardB[p])) stats.boardFullRound.B = round;

    // Habilidad de Nucleo (Reparar, 2 Escombros): heuristica simple para el simulador headless —
    // se usa apenas se puede pagar, no espera a acumular mas.
    if (tryReparar(boardA, escombros, "A")) stats.repararUsed.A += 1;
    if (tryReparar(boardB, escombros, "B")) stats.repararUsed.B += 1;

    // Fase 2 — orden
    const priorityFirst = round % 2 === 1 ? "A" : "B";
    const order = buildTurnOrder(boardA, boardB, priorityFirst);

    // Fase 3/4 — acciones + resolucion (linea de tiro siempre activa, es la regla adoptada).
    // resolveTurn (turnResolution.js) hace todo el ritual por turno: salida de Magic por Linaje,
    // aura de Estandarte, Paciente/Sereno post-golpe, y repite el golpe si aplica Gemelo/Implacable.
    for (const { battler, side } of order) {
      if (battler.fallen || battler.collapsed) continue;
      // Colosal: "no actua la ronda en que se despliega" — solo tiene sentido en este modelo de
      // despliegue continuo (el baseline sin economia despliega todo el mazo de una en "ronda 1",
      // asi que ahi no aplica). `justDeployed` se apaga en el primer resetRoundFlags que le toca
      // (la ronda SIGUIENTE a la que entro al tablero), ver board.js#makeBattler/#resetRoundFlags.
      if (isColosalGrounded(battler)) continue;
      const defBoard = side === "A" ? boardB : boardA;
      const defNucleo = side === "A" ? nucleoB : nucleoA;
      const ownBoard = side === "A" ? boardA : boardB;

      const results = resolveTurn(battler, side, {
        ownBoard,
        defBoard,
        defNucleo,
        escombros,
        getImpulso: () => (side === "A" ? impulsoA : impulsoB),
        spendImpulso: (n) => { if (side === "A") impulsoA -= n; else impulsoB -= n; },
        round,
        nucleoShieldRounds,
        lineOfSight: round > graceRounds,
      });

      for (const result of results) {
        if (result.magicFallbackAttempted) {
          stats.magicFallback.attempts += 1;
          if (result.magicFallbackKind) {
            stats.magicFallback.ok += 1;
            stats.magicFallback.byKind[result.magicFallbackKind] = (stats.magicFallback.byKind[result.magicFallbackKind] || 0) + 1;
          } else {
            stats.magicFallback.failed += 1;
          }
        }
        log.push({ round, side, card: battler.card.identity.displayName, ...result });
        if (result.kind === "hit_unit" && result.fell) stats.torsoBreaks += 1;
      }

      if (nucleoA.hp <= 0) { winner = "B"; break; }
      if (nucleoB.hp <= 0) { winner = "A"; break; }
    }
    if (winner) break;

    // Fase 5 — bajas (Colapso, Detonante en el instante, despues liberar casilleros y cobrar Escombros/Renaciente)
    for (const b of aliveBattlers(boardA)) if (checkCollapse(b)) { stats.collapses += 1; applyCollapseTraits(b, boardA); }
    for (const b of aliveBattlers(boardB)) if (checkCollapse(b)) { stats.collapses += 1; applyCollapseTraits(b, boardB); }
    clearFallenSlots(boardA, graveyardA, escombros, "A", handA);
    clearFallenSlots(boardB, graveyardB, escombros, "B", handB);
  }

  if (!winner) {
    winner = nucleoA.hp === nucleoB.hp ? "draw" : nucleoA.hp > nucleoB.hp ? "A" : "B";
  }

  return {
    winner,
    rounds: round,
    nucleoA: nucleoA.hp,
    nucleoB: nucleoB.hp,
    escombros,
    stats,
    log,
  };
}
