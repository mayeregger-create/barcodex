// src/combat/board.js
// Estado de tablero para el simulador headless (doc "Sistema de juego" §2). Alcance de ESTA
// primera pasada, deliberadamente acotado — ver el chat: el objetivo es responder los pendientes
// del §17 (duracion del torso, dominancia de Blunt, Colapso vs. muerte por torso) con numeros
// reales, no construir el juego completo todavia.
//
// Explicitamente AFUERA de esta pasada (no modelado):
//  - Empuje / movimiento — cada unidad SIEMPRE ataca, nunca se mueve. Se despliega una vez y
//    queda fija en su posicion todo el combate.
//  - Escombros / habilidades activadas del Nucleo, e inversion de Regente (el Nucleo arranca en
//    un flat de 8, sin el bonus de Integridad de torso del Regente).
//  - Los 58 rasgos como comportamiento de COMBATE (solo sus efectos de generacion, ya aplicados
//    por cardgen, quedan reflejados en los numeros de la carta).
import { ZONES } from "../cardgen/zones.js";
import { DAMAGE_TYPES } from "../cardgen/classGen.js";

export const POSITIONS = [1, 2, 3];
export const NUCLEO_BASE = 8;

// Torso es el "hub": las 4 zonas restantes son contiguas a el, no entre si. Blunt pega 2 zonas
// contiguas (doc §3.1) — con esta topologia, un golpe siempre incluye el torso + un miembro,
// salvo que el torso ya este roto (unidad caida, no aplica).
const ADJACENCY = {
  head: ["torso"],
  torso: ["head", "armMain", "armOff", "legs"],
  armMain: ["torso"],
  armOff: ["torso"],
  legs: ["torso"],
};

export function adjacentZones(zone) {
  return ADJACENCY[zone] || [];
}

/** Arma un battler de combate a partir de una carta generada (cardgen/card.js#generateCard). */
export function makeBattler(generated) {
  const zones = {};
  for (const z of ZONES) {
    zones[z] = { ...generated.zones[z], broken: generated.zones[z].integrity <= 0 };
  }
  return {
    card: generated,
    zones,
    strength: generated.combat.strength,
    initiative: generated.combat.initiative,
    activeType: generated.combat.damageTypeActive,
    fallen: false, // torso a 0 — "muerte", se saca del tablero de inmediato
    collapsed: false, // ambos brazos rotos, o piernas + brazo principal — se retira a Caidos en Fase 5
    weaponSwapped: false, // brazo principal roto, paso a brazo secundario (doc §4.2)
  };
}

/** Ubica hasta 3 cartas en las 3 posiciones, respetando la Estacion de cada tipo de dano (doc §3):
 * Blunt/Cut van adelante, Pierce atras, Magic donde sobre. Heuristica de despliegue GREEDY, no
 * optimizacion real — si dos unidades compiten por la misma posicion legal, la primera en la
 * lista se queda con ella y la otra cae a la siguiente posicion libre que igual sea legal para su
 * tipo; si no queda ninguna, esa unidad no se despliega (deck mal armado, ver doc §14.2). */
export function autoDeploy(generatedCards) {
  const board = { 1: null, 2: null, 3: null };
  const byFrontPreference = [...generatedCards].sort((a, b) => {
    const pref = (c) => Math.min(...DAMAGE_TYPES[c.combat.damageTypeActive].station);
    return pref(a) - pref(b);
  });
  const undeployed = [];
  for (const card of byFrontPreference) {
    const legal = DAMAGE_TYPES[card.combat.damageTypeActive].station;
    const slot = legal.find((p) => !board[p]);
    if (slot) board[slot] = makeBattler(card);
    else undeployed.push(card);
  }
  return { board, undeployed };
}

export function aliveBattlers(board) {
  return POSITIONS.map((p) => board[p]).filter((b) => b && !b.fallen && !b.collapsed);
}

/** Suplentes entrando a un casillero vacio (aproxima la Fase 3 real, donde el despliegue pasa
 * TODAS las rondas, no solo al arrancar — ver chat: esto importa mas para el numero de Pierce que
 * el movimiento en si, porque mantiene el tablero rival poblado en vez de ir vaciandose y dejando
 * huecos permanentes). Muta `board` y el array `reserve` (le saca las cartas que entran). */
export function backfillFromReserve(board, reserve) {
  for (const p of POSITIONS) {
    if (board[p]) continue;
    const idx = reserve.findIndex((card) => DAMAGE_TYPES[card.combat.damageTypeActive].station.includes(p));
    if (idx === -1) continue;
    const [card] = reserve.splice(idx, 1);
    board[p] = makeBattler(card);
  }
}

/** Coloca una carta recien comprometida (Regente al arrancar, o una carta que la economia de
 * Impulso acaba de pagar — ver economy.js): directo al tablero si hay un casillero libre legal
 * para su Estacion, si no a la Reserva, donde backfillFromReserve la levanta gratis apenas se abra
 * un lugar. Muta `board` y `reserve`. */
export function placeCard(card, board, reserve) {
  const legal = DAMAGE_TYPES[card.combat.damageTypeActive].station;
  const slot = legal.find((p) => !board[p]);
  if (slot) board[slot] = makeBattler(card);
  else reserve.push(card);
}
