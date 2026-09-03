// src/combat/targeting.js
// Las 4 reglas de punteria (doc "Sistema de juego" §3.1) traducidas a una eleccion DETERMINISTA
// para un simulador headless — el juego real deja esto a la decision del jugador (Pierce/Preciso)
// o lo resuelve solo (Cut/Blunt/Magic); para AI simple uso una heuristica "rematar lo mas debil"
// consistente en los 4 casos, documentada aca, no una estrategia optima.
import { DAMAGE_TYPES } from "../cardgen/classGen.js";
import { ZONES } from "../cardgen/zones.js";
import { adjacentZones } from "./board.js";
import { hasTrait } from "./traits.js";

/** @param {{ unplatedOnly?: boolean, excludeResidue?: boolean }} [opts] - excludeResidue: rasgo
 * "escamado" del DEFENSOR — una zona que alguna vez tuvo placa sigue bloqueando Pierce aunque esa
 * placa ya llegue a 0 ("un resto que sigue bloqueando"). */
function livingZones(battler, { unplatedOnly = false, excludeResidue = false } = {}) {
  return ZONES.filter((z) => {
    const zone = battler.zones[z];
    if (zone.integrity <= 0) return false;
    if (unplatedOnly && zone.plate > 0) return false;
    if (excludeResidue && zone.plate <= 0 && zone.everPlated) return false;
    return true;
  });
}

function weakest(zones, battler) {
  if (zones.length === 0) return null;
  return zones.reduce((a, b) => (battler.zones[a].integrity <= battler.zones[b].integrity ? a : b));
}

/** Posicion enemiga alcanzable + con alguien vivo, mas cercana dentro del Alcance del tipo. */
function pickTargetPosition(activeType, defenderBoard) {
  const reach = DAMAGE_TYPES[activeType].reach;
  const occupied = reach.filter((p) => defenderBoard[p] && !defenderBoard[p].fallen && !defenderBoard[p].collapsed);
  if (occupied.length === 0) return null;
  return Math.min(...occupied);
}

function anyDefenderAlive(defenderBoard) {
  return [1, 2, 3].some((p) => defenderBoard[p] && !defenderBoard[p].fallen && !defenderBoard[p].collapsed);
}

/** Linea de tiro (reemplaza al §2.2 "tablero 100% limpio" — decision tomada en el chat despues de
 * verificar en el simulador que la regla vieja trababa el 45% de las partidas en empate, contra
 * 1.2% con esta): si TODAS las posiciones dentro del Alcance de este tipo estan vacias, el golpe
 * sigue de largo hasta el Nucleo. Magic queda afuera de este chequeo a proposito — su regla ya es
 * propia (alcanza el Nucleo siempre) y no cambia aca. */
function lineOfSightOpen(activeType, defenderBoard) {
  if (activeType === "magic") return false;
  const reach = DAMAGE_TYPES[activeType].reach;
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

  // Nucleo expuesto: sin unidades enemigas en pie, cualquier tipo lo alcanza (doc §2.2).
  if (!anyDefenderAlive(defenderBoard)) {
    return { nucleo: true };
  }

  if (lineOfSight && lineOfSightOpen(activeType, defenderBoard)) {
    return { nucleo: true };
  }

  const position = pickTargetPosition(activeType, defenderBoard);
  if (position === null) return null; // hay rivales vivos, pero ninguno dentro del Alcance de este tipo

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
    const pool = adjacentZones("torso").filter((z) => defender.zones[z].integrity > 0);
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
