// src/combat/board.js
// Estado de tablero para el simulador headless (doc "Sistema de juego" §2). Alcance de ESTA
// primera pasada, deliberadamente acotado — ver el chat: el objetivo es responder los pendientes
// del §17 (duracion del torso, dominancia de Blunt, Colapso vs. muerte por torso) con numeros
// reales, no construir el juego completo todavia.
//
// Explicitamente AFUERA de esta pasada (no modelado):
//  - Movimiento como fase general con eleccion del jugador — una unidad nunca decide moverse en
//    vez de atacar. Lo que SI existe es movimiento como EFECTO de otra cosa: Arrollador/Arponero
//    empujan o arrastran al defensor tras un golpe (pushBattler), Elusivo intercambia lugar con un
//    aliado al ser el blanco elegido (elusivoSwap). Errante ("movimiento 2 posiciones por accion")
//    sigue afuera a proposito: el Alcance de un tipo de dano NO depende de la posicion propia del
//    atacante en este motor, asi que "moverse para encontrar objetivo" no resolveria nada real —
//    es un rasgo que necesita eleccion real del jugador, misma categoria que Preciso.
//  - La mayoria de los 58 rasgos como comportamiento de COMBATE siguen siendo solo sus efectos de
//    generacion — pero un subconjunto YA vive aca/resolve.js/targeting.js/simulate.js: brutal,
//    carnicero, ejecutor, runico, escamado, remachado, certero, sismico, estandarte, vengativo,
//    reflejo, diestro, yelmo_sellado, escurridizo, fulminante, paciente, sereno, flanqueador,
//    avanzado, atalaya, arrollador, arponero, inamovible, elusivo (combate) + abastecedor, leal
//    (economia/despliegue, ver economy.js). El resto (turnos extra ya cubiertos en
//    turnResolution.js, legendarios, etc.) sigue pendiente — ver traits.test.js para el detalle.
import { ZONES } from "../cardgen/zones.js";
import { DAMAGE_TYPES } from "../cardgen/classGen.js";
import { hasTrait, cardHasTrait } from "./traits.js";

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

/** Posiciones de tablero adyacentes a `position` (topologia lineal 1-2-3, la misma que usan
 * Estacion/Alcance) — para auras y rasgos que miran al vecino, no al cuerpo propio. */
export function adjacentPositions(position) {
  return POSITIONS.filter((p) => Math.abs(p - position) === 1);
}

/** En que posicion de `board` esta `battler` — null si no esta ahi. Compartido entre los rasgos
 * que necesitan ubicarse a si mismos para mirar a sus vecinos (Estandarte, Injerto en
 * magicFallback.js). */
export function positionOf(battler, board) {
  const found = POSITIONS.find((p) => board[p] === battler);
  return found === undefined ? null : found;
}

/** Arma un battler de combate a partir de una carta generada (cardgen/card.js#generateCard). */
export function makeBattler(generated) {
  const zones = {};
  for (const z of ZONES) {
    zones[z] = { ...generated.zones[z], broken: generated.zones[z].integrity <= 0, everPlated: generated.zones[z].plate > 0 };
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
    remachadoUsed: false, // rasgo "remachado": 1 vez por partida, una placa rota se repone
    reflejoUsedThisRound: false, // rasgo "reflejo": 1 vez por ronda, contraataca si sobrevive a un golpe
    pacienteStacks: 0, // rasgo "paciente": +2 Fuerza acumulativo por cada ronda que no ataca
    implacableUsedThisRound: false, // rasgo "implacable": 1 vez por ronda, ataca de nuevo si rompio una zona
  };
}

/** Posiciones legales de despliegue para una carta — normalmente su Estacion (doc §3), pero
 * algunos rasgos la anulan: Avanzado siempre entra en pos.1, Atalaya siempre en pos.3, Flanqueador
 * puede entrar en cualquiera. Compartida por placeCard/backfillFromReserve/autoDeploy para que
 * ningun camino de despliegue se olvide de un rasgo. */
export function legalStationFor(card) {
  if (cardHasTrait(card, "avanzado")) return [1];
  if (cardHasTrait(card, "atalaya")) return [3];
  if (cardHasTrait(card, "flanqueador")) return [...POSITIONS];
  return DAMAGE_TYPES[card.combat.damageTypeActive].station;
}

/** Aura del rasgo "estandarte": +1 Fuerza por cada aliado ADYACENTE (no uno mismo) que lo tenga.
 * Vive aca (no en resolve.js) porque necesita el tablero propio para ubicar vecinos — resolve.js
 * no sabe de topologia de tablero, solo de zonas de un battler. */
export function estandarteBonusFor(battler, ownBoard) {
  const myPos = positionOf(battler, ownBoard);
  if (myPos === null) return 0;
  let bonus = 0;
  for (const p of adjacentPositions(myPos)) {
    const ally = ownBoard[p];
    if (ally && ally !== battler && !ally.fallen && !ally.collapsed && hasTrait(ally, "estandarte")) bonus += 1;
  }
  return bonus;
}

/** Empuje (Arrollador) y arrastre (Arponero) — primera pieza de Movimiento real que se
 * implementa (ver el header del archivo: hasta ahora nada se movia). Solo estos dos rasgos y el
 * intercambio de Elusivo (ver `elusivoSwap`) — no una fase de movimiento general con eleccion del
 * jugador, eso sigue afuera. Inamovible/Baluarte bloquean AMBAS direcciones.
 * @param {number} direction - +1 empuja (aleja, hacia numero de posicion mas alto), -1 arrastra
 *   (acerca, hacia numero mas bajo).
 * @returns {number|null} la nueva posicion si se movio, null si no paso nada (inmune, borde del
 *   tablero, o casillero destino ocupado). */
export function pushBattler(board, position, direction) {
  const battler = board[position];
  if (!battler) return null;
  if (hasTrait(battler, "inamovible") || hasTrait(battler, "baluarte")) return null;
  const to = position + direction;
  if (!POSITIONS.includes(to) || board[to]) return null;
  board[to] = battler;
  board[position] = null;
  return to;
}

/** Elusivo (comun): al ser elegido como blanco, intercambia posicion con un aliado ADYACENTE
 * vivo, ANTES de que se elija la zona a golpear — asi el golpe termina cayendole a quien haya
 * quedado parado ahi, no solo "de nombre". Ninguno de los dos lados del intercambio puede tener
 * Baluarte ("no puede moverse"). Sin tope de usos: el rasgo no trae contrapartida de "una vez por
 * ronda" en el catalogo. Se llama desde targeting.js, justo despues de resolver la posicion y
 * antes de mirar zonas — por eso vive en board.js (topologia) y no en targeting.js/resolve.js. */
export function elusivoSwap(board, position) {
  const defender = board[position];
  if (!defender || !hasTrait(defender, "elusivo") || hasTrait(defender, "baluarte")) return null;
  for (const p of adjacentPositions(position)) {
    const ally = board[p];
    if (ally && ally !== defender && !ally.fallen && !ally.collapsed && !hasTrait(ally, "baluarte")) {
      board[position] = ally;
      board[p] = defender;
      return { from: position, to: p };
    }
  }
  return null;
}

/** Reinicia al arrancar cada ronda los flags de "una vez por ronda" (Reflejo, Implacable). Se
 * llama en la Fase 1, para ambos bandos. */
export function resetRoundFlags(board) {
  for (const p of POSITIONS) {
    if (!board[p]) continue;
    board[p].reflejoUsedThisRound = false;
    board[p].implacableUsedThisRound = false;
  }
}

/** Ubica hasta 3 cartas en las 3 posiciones, respetando la Estacion de cada tipo de dano (doc §3):
 * Blunt/Cut van adelante, Pierce atras, Magic donde sobre. Heuristica de despliegue GREEDY, no
 * optimizacion real — si dos unidades compiten por la misma posicion legal, la primera en la
 * lista se queda con ella y la otra cae a la siguiente posicion libre que igual sea legal para su
 * tipo; si no queda ninguna, esa unidad no se despliega (deck mal armado, ver doc §14.2). */
export function autoDeploy(generatedCards) {
  const board = { 1: null, 2: null, 3: null };
  const byFrontPreference = [...generatedCards].sort((a, b) => {
    const pref = (c) => Math.min(...legalStationFor(c));
    return pref(a) - pref(b);
  });
  const undeployed = [];
  for (const card of byFrontPreference) {
    const legal = legalStationFor(card);
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
    const idx = reserve.findIndex((card) => legalStationFor(card).includes(p));
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
  const legal = legalStationFor(card);
  const slot = legal.find((p) => !board[p]);
  if (slot) board[slot] = makeBattler(card);
  else reserve.push(card);
}
