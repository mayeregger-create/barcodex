// src/combat/targeting.js
// Las 4 reglas de punteria (doc "Sistema de juego" §3.1) traducidas a una eleccion DETERMINISTA
// para un simulador headless — el juego real deja esto a la decision del jugador (Pierce/Preciso)
// o lo resuelve solo (Cut/Blunt/Magic); para AI simple uso una heuristica "rematar lo mas debil"
// consistente en los 4 casos, documentada aca, no una estrategia optima.
import { DAMAGE_TYPES } from "../cardgen/classGen.js";
import { ZONES } from "../cardgen/zones.js";
import { adjacentZones, elusivoSwap } from "./board.js";
import { hasTrait } from "./traits.js";

/** @param {{ unplatedOnly?: boolean, excludeResidue?: boolean }} [opts] - excludeResidue: rasgo
 * "escamado" del DEFENSOR — una zona que alguna vez tuvo placa sigue bloqueando Pierce aunque esa
 * placa ya llegue a 0 ("un resto que sigue bloqueando"). Yelmo Sellado (cabeza inmune a todo dano)
 * se excluye SIEMPRE de este pool, sin flag — para cualquier tipo de dano, no es un blanco real:
 * sin esto, el heuristico "el mas debil" la seguiria eligiendo una y otra vez (cabeza suele ser la
 * zona con menos Integridad de base) y cada golpe se perderia entero contra hitZone(). */
function livingZones(battler, { unplatedOnly = false, excludeResidue = false } = {}) {
  return ZONES.filter((z) => {
    const zone = battler.zones[z];
    if (zone.integrity <= 0) return false;
    if (z === "head" && hasTrait(battler, "yelmo_sellado")) return false;
    if (unplatedOnly && zone.plate > 0) return false;
    if (excludeResidue && zone.plate <= 0 && zone.everPlated) return false;
    return true;
  });
}

function weakest(zones, battler) {
  if (zones.length === 0) return null;
  return zones.reduce((a, b) => (battler.zones[a].integrity <= battler.zones[b].integrity ? a : b));
}

/** Alcance efectivo de un atacante — normalmente el de su tipo de dano, pero Atalaya lo sube a
 * "todo el tablero" (doc: "Alcance +1", que en una linea de 3 posiciones equivale a poder llegar a
 * cualquiera, incluida la posicion 1 que ningun otro tipo con Alcance corto toca desde atras).
 * Devastador hace lo inverso ("Alcance -1"): se queda solo con la posicion mas cercana de su
 * Alcance normal — interpretacion propia, simetrica a la de Atalaya (que ya tomo "+1" como "toda
 * la linea"), asi que "-1" es "recorta a la posicion mas cercana disponible". Si ambos rasgos
 * coincidieran en la misma carta (Anomalo), Atalaya gana — se chequea primero. */
function effectiveReach(attacker) {
  if (hasTrait(attacker, "atalaya")) return [1, 2, 3];
  const base = DAMAGE_TYPES[attacker.activeType].reach;
  if (hasTrait(attacker, "devastador")) return [Math.min(...base)];
  return base;
}

/** Posicion enemiga alcanzable + con alguien vivo, mas cercana dentro del Alcance. */
function pickTargetPosition(reach, defenderBoard) {
  const occupied = reach.filter((p) => defenderBoard[p] && !defenderBoard[p].fallen && !defenderBoard[p].collapsed);
  if (occupied.length === 0) return null;
  return Math.min(...occupied);
}

function anyDefenderAlive(defenderBoard) {
  return [1, 2, 3].some((p) => defenderBoard[p] && !defenderBoard[p].fallen && !defenderBoard[p].collapsed);
}

/** Linea de tiro (reemplaza al §2.2 "tablero 100% limpio" — decision tomada en el chat despues de
 * verificar en el simulador que la regla vieja trababa el 45% de las partidas en empate, contra
 * 1.2% con esta): si TODAS las posiciones dentro del Alcance estan vacias, el golpe sigue de largo
 * hasta el Nucleo. Magic queda afuera de este chequeo a proposito — su regla ya es propia (alcanza
 * el Nucleo siempre) y no cambia aca. */
function lineOfSightOpen(activeType, reach, defenderBoard) {
  if (activeType === "magic") return false;
  return reach.every((p) => !defenderBoard[p] || defenderBoard[p].fallen || defenderBoard[p].collapsed);
}

/**
 * @param {object} attacker - el battler que ataca (no solo su tipo: algunos rasgos del atacante,
 *   como Certero o Sismico, cambian como elige zona).
 * @param {boolean} [lineOfSight] - default true: la regla real (linea de tiro). false queda solo
 *   para poder seguir comparando contra la regla vieja del doc si hace falta.
 * @returns {null | { nucleo: true } | { position: number, zones: string[] }}
 * null = sin objetivo posible este turno (el tipo no alcanza ninguna posicion ocupada, aunque el
 * rival tenga gente viva en otro lado — un turno perdido de verdad, dato relevante para el
 * balance).
 */
export function selectTarget(attacker, defenderBoard, lineOfSight = true) {
  const activeType = attacker.activeType;
  const reach = effectiveReach(attacker);

  // Nucleo expuesto: sin unidades enemigas en pie, cualquier tipo lo alcanza (doc §2.2).
  if (!anyDefenderAlive(defenderBoard)) {
    return { nucleo: true };
  }

  if (lineOfSight && lineOfSightOpen(activeType, reach, defenderBoard)) {
    return { nucleo: true };
  }

  const position = pickTargetPosition(reach, defenderBoard);
  if (position === null) return null; // hay rivales vivos, pero ninguno dentro del Alcance efectivo

  // Elusivo (defensor): intercambia lugar con un aliado adyacente ANTES de elegir zona — asi el
  // golpe cae sobre quien haya quedado parado ahi de verdad, no sobre quien fue elegido "de
  // nombre". Tiene que pasar aca, antes del `defender = ...` de abajo, no despues del golpe.
  elusivoSwap(defenderBoard, position);

  const defender = defenderBoard[position];

  if (activeType === "pierce") {
    // Certero (rasgo del atacante): puede apuntar a zonas con placa (a mitad de dano, ver
    // resolve.js#hitZone) en vez de estar restringido a zonas desnudas.
    const pool = hasTrait(attacker, "certero")
      ? livingZones(defender)
      : livingZones(defender, { unplatedOnly: true, excludeResidue: hasTrait(defender, "escamado") });
    const zone = weakest(pool, defender);
    return zone ? { position, zones: [zone] } : null; // sin zona valida disponible: no puede apuntar
  }

  if (activeType === "cut") {
    let zone = weakest(livingZones(defender, { unplatedOnly: true }), defender);
    if (!zone) zone = weakest(livingZones(defender), defender); // todo placado: cualquiera sirve (solo quita placa)
    return { position, zones: [zone] };
  }

  if (activeType === "blunt") {
    // Torso + zonas contiguas mas debiles (doc: "dos zonas contiguas"; Sismico del atacante sube
    // esto a 3) — el battler solo esta en tablero si su torso sigue con Integridad > 0 (si no, ya
    // cayo), asi que torso siempre es un objetivo valido aca.
    const extraCount = hasTrait(attacker, "sismico") ? 2 : 1;
    const pool = adjacentZones("torso").filter(
      (z) => defender.zones[z].integrity > 0 && !(z === "head" && hasTrait(defender, "yelmo_sellado"))
    );
    const companions = [];
    for (let i = 0; i < extraCount && pool.length > 0; i++) {
      const pick = weakest(pool, defender);
      companions.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return { position, zones: ["torso", ...companions] };
  }

  // magic: cualquier zona, ignora placa (salvo que el defensor tenga "runico", ver resolve.js).
  const zone = weakest(livingZones(defender), defender);
  return zone ? { position, zones: [zone] } : null;
}
