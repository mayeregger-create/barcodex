// src/core/gridCombat.js
// Motor de combate para el modo "Teamfight Tactics": tablero 3x3 por jugador, hasta 5
// personajes, patrones de ataque por Clase en vez del duelo 1vs1 de combat.js. Reusa las mismas
// formulas de daño/critico/rueda elemental (ver combat.js y squad.js) para que el numero que
// sale en pantalla se sienta igual que en Partida Rápida — lo que cambia es a QUIEN le pega cada
// clase, no cuanto pega.

import { baseDamage, critChance } from "./combat.js";
import { wheelModifier } from "./squad.js";
import { generateCharacter, randomCode } from "./character.js";

export const GRID_ROWS = 3;
export const GRID_COLS = 3;
export const GRID_SIZE = GRID_ROWS * GRID_COLS;
export const MAX_UNITS = 5;

export function rowOf(slot) {
  return Math.floor(slot / GRID_COLS);
}
export function colOf(slot) {
  return slot % GRID_COLS;
}
export function slotAt(row, col) {
  return row * GRID_COLS + col;
}
function columnSlots(col) {
  return [0, 1, 2].map((r) => slotAt(r, col));
}
function rowSlots(row) {
  return [0, 1, 2].map((c) => slotAt(row, c));
}

function makeBattler(character) {
  return {
    character,
    hp: character.hpMax,
    alive: true,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    abilitiesUsedCount: 0,
    parriesBlockedCount: 0,
  };
}

/** placements: [{ slot, character }] — arma un tablero de 9 casilleros, el resto null. */
export function makeBoard(placements) {
  const board = Array(GRID_SIZE).fill(null);
  for (const { slot, character } of placements) board[slot] = makeBattler(character);
  return board;
}

// Fila preferida por clase: Tanque/Guerrero al frente (fila 0, la mas cercana a la division),
// Picaro al medio (flanquea), Mago/Bardo al fondo (fila 2) — ver diseño hablado en el chat.
const ROW_PREF = { Tanque: 0, Guerrero: 0, Picaro: 1, Mago: 2, Bardo: 2 };
const COL_ORDER = [1, 0, 2]; // centro primero, despues flancos

/** Ubica personajes (hasta 5) en el tablero segun su Clase — usado para el rival de CPU, y
 * disponible como botón "Auto" para el jugador si no quiere acomodar a mano. */
export function autoFormation(characters) {
  const board = Array(GRID_SIZE).fill(false); // ocupacion
  const placements = [];
  for (const character of characters.slice(0, MAX_UNITS)) {
    const preferredRow = ROW_PREF[character.clase] ?? 1;
    let slot = null;
    for (const row of [preferredRow, ...[0, 1, 2].filter((r) => r !== preferredRow)]) {
      const free = COL_ORDER.map((c) => slotAt(row, c)).find((s) => !board[s]);
      if (free !== undefined) {
        slot = free;
        break;
      }
    }
    if (slot === null) continue; // tablero lleno (no deberia pasar con <=5 en 9 casilleros)
    board[slot] = true;
    placements.push({ slot, character });
  }
  return placements;
}

export function randomRivalCharacters(n) {
  return Array.from({ length: n }, () => generateCharacter(randomCode()));
}

function firstOccupied(board, slots) {
  for (const s of slots) if (board[s]?.alive) return s;
  return null;
}

/** El patron de cada clase, SIN red de seguridad: puede devolver vacio si nadie vivo cae justo
 * en las casillas que esa clase mira (p.ej. un Tanque cuya columna rival esta despoblada, pero
 * el rival tiene gente viva en otra columna). selectTargets() de mas abajo es la que garantiza
 * que, mientras el rival tenga a alguien vivo, SIEMPRE haya un objetivo — sin esa garantia el
 * autobattle puede quedar trabado para siempre en "no encuentra objetivo" de los dos lados. */
function patternTargets(clase, attackerSlot, enemyBoard) {
  const col = colOf(attackerSlot);

  if (clase === "Tanque") {
    const target = firstOccupied(enemyBoard, columnSlots(col));
    return target === null ? [] : [target];
  }

  if (clase === "Guerrero") {
    const cols = [col - 1, col, col + 1].filter((c) => c >= 0 && c < GRID_COLS);
    const frontTargets = cols.map((c) => slotAt(0, c)).filter((s) => enemyBoard[s]?.alive);
    if (frontTargets.length > 0) return frontTargets;
    const fallback = firstOccupied(enemyBoard, cols.flatMap((c) => columnSlots(c)));
    return fallback === null ? [] : [fallback];
  }

  if (clase === "Mago") {
    const targets = columnSlots(col).filter((s) => enemyBoard[s]?.alive);
    if (targets.length > 0) return targets;
    for (const c of [col - 1, col + 1]) {
      if (c < 0 || c >= GRID_COLS) continue;
      const t = columnSlots(c).filter((s) => enemyBoard[s]?.alive);
      if (t.length > 0) return t;
    }
    return [];
  }

  if (clase === "Picaro") {
    const sameCol = firstOccupied(enemyBoard, [slotAt(2, col), slotAt(1, col), slotAt(0, col)]);
    if (sameCol !== null) return [sameCol];
    const anyBack = firstOccupied(enemyBoard, [2, 1, 0].flatMap((r) => rowSlots(r)));
    return anyBack === null ? [] : [anyBack];
  }

  return []; // Bardo: no ataca, ver takeAction
}

/** A que casillero(s) del tablero RIVAL apunta cada Clase, dado el casillero propio del
 * atacante. Prueba primero el patron de la Clase (Tanque pega derecho, Guerrero barre el frente,
 * Mago perfora toda la columna, Picaro salta al fondo); si esa lectura no encuentra a nadie pero
 * el rival SI tiene gente viva en otro lado del tablero, cae a esa gente igual — un ataque real
 * nunca deberia "no encontrar objetivo" solo porque la geometria no dio, eso trababa el combate
 * entero. Bardo nunca llega aca (no ataca, ver takeAction). */
export function selectTargets(clase, attackerSlot, enemyBoard) {
  const targets = patternTargets(clase, attackerSlot, enemyBoard);
  if (targets.length > 0) return targets;
  const anyAlive = firstOccupied(enemyBoard, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  return anyAlive === null ? [] : [anyAlive];
}

function resolveHit(attackerChar, defenderChar, mult) {
  const dmgMod = wheelModifier(attackerChar.continente, defenderChar.continente).dmgMod;
  const isCrit = Math.random() < critChance(attackerChar.stats.Suerte, attackerChar.clase);
  let dmg = baseDamage(attackerChar.stats.Fuerza, defenderChar.stats.Defensa) * dmgMod * mult;
  if (isCrit) dmg *= 1.5;
  return { dmg: Math.max(1, Math.round(dmg)), isCrit };
}

function lowestHpAlly(board, exceptSlot) {
  let best = null;
  let bestPct = Infinity;
  board.forEach((b, slot) => {
    if (!b || !b.alive || slot === exceptSlot) return;
    const pct = b.hp / b.character.hpMax;
    if (pct < bestPct) {
      bestPct = pct;
      best = slot;
    }
  });
  return best;
}

function buildQueue(playerBoard, rivalBoard) {
  const units = [];
  playerBoard.forEach((b, slot) => {
    if (b?.alive) units.push({ side: "player", slot, v: b.character.stats.Velocidad, s: b.character.stats.Suerte });
  });
  rivalBoard.forEach((b, slot) => {
    if (b?.alive) units.push({ side: "rival", slot, v: b.character.stats.Velocidad, s: b.character.stats.Suerte });
  });
  units.sort((a, b) => b.v - a.v || b.s - a.s);
  return units.map(({ side, slot }) => ({ side, slot }));
}

export function initialGridBattle(playerPlacements, rivalPlacements) {
  const playerBoard = makeBoard(playerPlacements);
  const rivalBoard = makeBoard(rivalPlacements);
  return {
    playerBoard,
    rivalBoard,
    queue: buildQueue(playerBoard, rivalBoard),
    log: ["¡Comienza el combate!"],
    phase: "battle",
    winner: null,
    lastActor: null, // { side, slot } — solo para resaltar en pantalla, no afecta la simulacion
  };
}

function takeAction(side, slot, state) {
  const board = side === "player" ? [...state.playerBoard] : [...state.rivalBoard];
  const enemyBoard = side === "player" ? [...state.rivalBoard] : [...state.playerBoard];
  const attacker = board[slot];
  const log = [...state.log];

  if (attacker.character.clase === "Bardo") {
    const allyIdx = lowestHpAlly(board, slot);
    if (allyIdx === null) {
      log.push(`${attacker.character.nombre} no tiene a quién inspirar.`);
    } else {
      const ally = board[allyIdx];
      const heal = Math.max(1, Math.round(attacker.character.stats.Suerte * 1.5));
      const newHp = Math.min(ally.character.hpMax, ally.hp + heal);
      const healed = newHp - ally.hp;
      board[allyIdx] = { ...ally, hp: newHp };
      log.push(`${attacker.character.nombre} inspira a ${ally.character.nombre}: +${healed} PV.`);
    }
    const key = side === "player" ? "playerBoard" : "rivalBoard";
    return { ...state, [key]: board, log, lastActor: { side, slot } };
  }

  const targets = selectTargets(attacker.character.clase, slot, enemyBoard);
  if (targets.length === 0) {
    log.push(`${attacker.character.nombre} no encuentra objetivo.`);
    return { ...state, log, lastActor: { side, slot } };
  }

  const mult = targets.length > 1 ? 0.7 : 1;
  let dealt = 0;
  for (const targetSlot of targets) {
    const defender = enemyBoard[targetSlot];
    if (!defender?.alive) continue;
    const { dmg, isCrit } = resolveHit(attacker.character, defender.character, mult);
    const newHp = Math.max(0, defender.hp - dmg);
    const alive = newHp > 0;
    enemyBoard[targetSlot] = {
      ...defender,
      hp: newHp,
      alive,
      totalDamageTaken: (defender.totalDamageTaken || 0) + dmg,
    };
    dealt += dmg;
    log.push(
      `${attacker.character.nombre} golpea a ${defender.character.nombre} por ${dmg}` +
      `${isCrit ? " (¡Crítico!)" : ""}${!alive ? " — ¡cae!" : ""}.`
    );
  }
  board[slot] = { ...attacker, totalDamageDealt: (attacker.totalDamageDealt || 0) + dealt };

  const ownKey = side === "player" ? "playerBoard" : "rivalBoard";
  const enemyKey = side === "player" ? "rivalBoard" : "playerBoard";
  return { ...state, [ownKey]: board, [enemyKey]: enemyBoard, log, lastActor: { side, slot } };
}

/** Un paso del autobattle: saca de la cola al proximo vivo (reconstruye la cola si se vacio),
 * ejecuta su accion y chequea condicion de victoria. Mismo patron que CombatScreen.jsx#advanceTurn
 * pero para todo el tablero en vez de 1vs1. */
export function advanceGridTurn(state) {
  if (state.phase !== "battle") return state;

  let queue = state.queue;
  while (queue.length > 0) {
    const next = queue[0];
    const board = next.side === "player" ? state.playerBoard : state.rivalBoard;
    if (board[next.slot]?.alive) break;
    queue = queue.slice(1);
  }
  if (queue.length === 0) {
    queue = buildQueue(state.playerBoard, state.rivalBoard);
    if (queue.length === 0) return state;
  }

  const { side, slot } = queue[0];
  const afterAction = takeAction(side, slot, { ...state, queue: queue.slice(1) });

  const rivalAlive = afterAction.rivalBoard.some((b) => b?.alive);
  const playerAlive = afterAction.playerBoard.some((b) => b?.alive);
  if (!rivalAlive) {
    return { ...afterAction, phase: "over", winner: "player", log: [...afterAction.log, "¡Ganaste el combate!"] };
  }
  if (!playerAlive) {
    return { ...afterAction, phase: "over", winner: "rival", log: [...afterAction.log, "El rival ganó el combate."] };
  }
  return afterAction;
}
