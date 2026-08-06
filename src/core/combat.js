// src/core/combat.js
// Formulas de combate (seccion 8) + Parry (seccion 8.1).
// Este modulo da las funciones puras de calculo; el manejo de turnos / estado de partida
// se deja a la capa de UI (ver los prototipos en el chat para un ejemplo de state machine).

import { wheelModifier } from "./squad.js";

/**
 * Daño basico de un ataque. Nunca menos de 1.
 * Divisor recalibrado en playtesting: con /2 la Defensa le comía casi todo el golpe a cualquier
 * clase sin Fuerza alta (Picaro/Bardo/Mago/Tanque atacando), clampeando a 1 en ~24% de los
 * enfrentamientos al azar. Con /3 la Defensa sigue pesando, pero no ahoga el daño de esas clases.
 */
export function baseDamage(atacanteFuerza, objetivoDefensa) {
  return Math.max(1, atacanteFuerza - objetivoDefensa / 3);
}

/** HP maximo de un personaje ya generado (redundante con character.js, expuesto por claridad). */
export function hpMax(fuerza, defensa) {
  return Math.round((fuerza + defensa) * 1.5 + 15);
}

/**
 * Resuelve un intento de Parry.
 * @param {object} actor - personaje que bloquea (con .parry, .stats.Suerte)
 * @param {"afin"|"rival"|"mismo"} rel - relacion elemental contra el atacante actual
 * @param {number} incomingDmg - daño que se hubiera recibido
 * @returns {{blocked: boolean, energyGain: number, reflectDmg: number}}
 */
export function resolveParry(actor, rel, incomingDmg) {
  const { block, reflect } = actor.parry;
  let blockChance = block === null ? Math.max(0.2, Math.min(0.8, actor.stats.Suerte / 100)) : block;
  if (rel === "rival") blockChance = Math.min(0.95, blockChance + 0.10);

  if (Math.random() >= blockChance) {
    return { blocked: false, energyGain: 0, reflectDmg: 0 };
  }
  if (rel === "afin") {
    return { blocked: true, energyGain: 1, reflectDmg: 0 };
  }
  const reflectPct = reflect === null ? 0.2 + Math.random() * 0.6 : reflect;
  return { blocked: true, energyGain: 0, reflectDmg: Math.round(incomingDmg * reflectPct) };
}

/** Probabilidad de critico. Bardo la duplica (pasivo de clase). */
export function critChance(suerte, clase) {
  const base = Math.min(0.6, suerte / 40); // calibrar en playtesting; placeholder razonable
  return clase === "Bardo" ? Math.min(1, base * 2) : base;
}

/**
 * Resuelve un golpe completo: daño base + modificador de rueda elemental + tirada de critico (x1.5).
 * @param {object} attacker - personaje que ataca.
 * @param {object} defender - personaje que recibe.
 * @param {number} dmgMod - modificador de la rueda elemental (wheelModifier(...).dmgMod).
 * @returns {{dmg: number, isCrit: boolean}}
 */
export function resolveAttack(attacker, defender, dmgMod = 1) {
  const isCrit = Math.random() < critChance(attacker.stats.Suerte, attacker.clase);
  let dmg = baseDamage(attacker.stats.Fuerza, defender.stats.Defensa) * dmgMod;
  if (isCrit) dmg *= 1.5;
  return { dmg: Math.max(1, Math.round(dmg)), isCrit };
}

/**
 * Decide quien empieza el turno segun Velocidad, con desempate por Suerte
 * y el pasivo de Picaro (gana empates automaticamente).
 */
export function resolveTurnOrder(charA, charB) {
  if (charA.stats.Velocidad === charB.stats.Velocidad) {
    if (charA.clase === "Picaro") return "A";
    if (charB.clase === "Picaro") return "B";
    return charA.stats.Suerte >= charB.stats.Suerte ? "A" : "B";
  }
  return charA.stats.Velocidad > charB.stats.Velocidad ? "A" : "B";
}

/* --- A partir de aca: formulas que ya tienen en cuenta los buffs de escuadron (ver squad.js) y
 * el estado de combate (battler), no solo el personaje "crudo" — ver forma de battler en
 * CombatScreen.jsx#makeSide. Antes vivian duplicadas dentro de CombatScreen; ahora las usa
 * tambien abilities.js, asi que quedan aca como fuente unica. --- */

export function effectiveDefensa(battler) {
  return battler.stats.Defensa * (1 + (battler.buff.defensa || 0) / 100);
}

export function effectiveCritChance(battler) {
  const base = critChance(battler.stats.Suerte, battler.character.clase);
  return Math.min(1, base + (battler.buff.critico || 0) / 100);
}

/**
 * Golpe completo entre dos battlers (no personajes crudos): rueda elemental + critico + Defensa
 * y Resistencia ya modificadas por buffs de escuadron. `mult` es el multiplicador propio de una
 * habilidad (1 = ataque normal) — ver abilities.js.
 */
export function computeAttack(attacker, defender, mult = 1) {
  const dmgMod = wheelModifier(attacker.character.continente, defender.character.continente).dmgMod;
  const isCrit = Math.random() < effectiveCritChance(attacker);
  let dmg = baseDamage(attacker.stats.Fuerza, effectiveDefensa(defender)) * dmgMod * mult;
  if (isCrit) dmg *= 1.5;
  const resist = defender.buff.resistencia || 0;
  dmg = Math.max(1, Math.round(dmg * (1 - resist / 100)));
  return { dmg, isCrit };
}

/**
 * Aplica el estado defensivo puntual de quien recibe el golpe (Paso fantasma / Piel de corteza,
 * ver abilities.js) a un daño ya calculado — se consume (una sola vez) al usarse. Devuelve el
 * daño final y el `status` actualizado, nunca muta el original.
 */
export function applyIncoming(status, rawDmg) {
  if (status.dodgeNext) {
    return { dmg: 0, dodged: true, halved: false, status: { ...status, dodgeNext: false } };
  }
  if (status.halfDmgNext) {
    return { dmg: Math.max(1, Math.round(rawDmg / 2)), dodged: false, halved: true, status: { ...status, halfDmgNext: false } };
  }
  return { dmg: rawDmg, dodged: false, halved: false, status };
}
