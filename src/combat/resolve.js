// src/combat/resolve.js
// Aplica un ataque: daño a zona/placa segun tipo (doc §5.3), cascada de zona rota (§4.1), costo
// de Magic (§3.1), daño a Nucleo. Muta los battlers/Nucleo directo (simulador headless, no el
// modelo inmutable de la UI real) — mas simple para correr miles de partidas rapido.
import { DAMAGE_TYPES } from "../cardgen/classGen.js";
import { ZONES } from "../cardgen/zones.js";
import { selectTarget } from "./targeting.js";
import { pushBattler } from "./board.js";
import { hasTrait } from "./traits.js";

export function effectiveFuerza(battler) {
  let fuerza = battler.strength;
  // Vengativo (raro): +1 Fuerza por cada zona PROPIA rota — recompensa aguantar daño. La
  // contrapartida (-1 Fuerza base) ya se aplica en generacion (cardgen/card.js), esto es solo la
  // parte dinamica que cambia con el estado de combate.
  if (hasTrait(battler, "vengativo")) {
    fuerza += ZONES.filter((z) => battler.zones[z].integrity <= 0).length;
  }
  // Paciente (raro): +2 Fuerza acumulativo por cada ronda que no ataco (ver applyPostAttackTraits) —
  // nunca se resetea, es la recompensa de "esperar" (su contrapartida es actuar siempre ultimo,
  // ver simulate.js#buildTurnOrder).
  if (hasTrait(battler, "paciente")) {
    fuerza += battler.pacienteStacks || 0;
  }
  return Math.min(fuerza, DAMAGE_TYPES[battler.activeType].fuerzaTope + 2);
}

/** Aplica la cascada de romper una zona (doc §4.1) — se llama UNA vez, justo cuando esa zona
 * cruza de Integridad > 0 a <= 0 en este golpe. */
function applyZoneBreakCascade(battler, zone) {
  if (zone === "head") {
    battler.initiative -= 2;
  } else if (zone === "torso") {
    battler.fallen = true; // "muerte" — no es Colapso, ver doc §4.3
  } else if (zone === "armMain") {
    const offIntact = battler.zones.armOff.integrity > 0;
    if (offIntact && !battler.weaponSwapped) {
      battler.weaponSwapped = true;
      // Diestro (comun): perder el brazo principal no le cuesta Fuerza al cambiar de mano.
      if (!hasTrait(battler, "diestro")) battler.strength = Math.max(0, battler.strength - 2); // doc §4.2
    }
  }
  // armOff/legs: sin efecto numerico modelado aca (bonus de clase / movimiento no estan en esta
  // primera pasada) — solo importan para el chequeo de Colapso, ver checkCollapse() abajo.
}

export function applyDamageToZone(defender, zoneName, dmg) {
  const zone = defender.zones[zoneName];
  const wasAlive = zone.integrity > 0;
  zone.integrity = Math.max(0, zone.integrity - dmg);
  if (wasAlive && zone.integrity <= 0) {
    zone.broken = true;
    zone.hitsToBreak = zone.hitsTaken; // snapshot para el reporte de balance (§17.3)
    applyZoneBreakCascade(defender, zoneName);
  }
}

/** Remachado (comun): 1 vez por partida, una placa que se acaba de romper se repone al toque —
 * se chequea justo despues de descontar la placa en Cut/Blunt. */
function tryRemachado(defender, zone) {
  if (zone.plate <= 0 && hasTrait(defender, "remachado") && !defender.remachadoUsed) {
    defender.remachadoUsed = true;
    zone.plate = 1;
  }
}

/**
 * Un golpe contra UNA zona, respetando placa segun tipo (doc §5.3) y los rasgos de ataque/defensa
 * que lo modifican. Devuelve que paso REALMENTE en este golpe — antes esto se inferia comparando
 * la suma de Integridad del tablero antes/despues, lo que mezclaba "rompio 1 de Placa mientras Cut
 * hacia su trabajo" con "no paso nada" bajo el mismo balde de "cero dano" — son cosas distintas
 * (una es la mecanica funcionando, la otra un verdadero golpe en el aire), asi que ahora se
 * distinguen en el origen del dato.
 * @returns {{ plateChipped: boolean, integrityDamage: number }}
 */
function hitZone(attacker, defender, zoneName, fuerza) {
  const activeType = attacker.activeType;
  const zone = defender.zones[zoneName];

  // Yelmo Sellado (raro, defensor): la cabeza es inmune a TODO dano, sin importar el tipo — se
  // chequea antes que nada, ni siquiera cuenta como golpe recibido para el §17.3.
  if (zoneName === "head" && hasTrait(defender, "yelmo_sellado")) {
    return { plateChipped: false, integrityDamage: 0 };
  }

  zone.hitsTaken = (zone.hitsTaken || 0) + 1; // instrumentacion para "cuantos golpes para romper" (§17.3)

  // Rasgos del atacante que suman Fuerza a ESTE golpe puntual (no a la ficha en general).
  let effFuerza = fuerza;
  if (hasTrait(attacker, "carnicero") && zone.plate <= 0) effFuerza += 2; // +2 contra zonas sin placa
  if (hasTrait(attacker, "ejecutor") && zone.integrity === 1) effFuerza += 3; // +3 rematando una zona en 1

  if (activeType === "magic") {
    // Runico (rasgo del DEFENSOR): sus placas tambien bloquean Magic, que normalmente la ignora.
    if (hasTrait(defender, "runico") && zone.plate > 0) {
      return { plateChipped: false, integrityDamage: 0 };
    }
    const before = zone.integrity;
    applyDamageToZone(defender, zoneName, effFuerza);
    return { plateChipped: false, integrityDamage: before - zone.integrity };
  }

  // Certero (rasgo del atacante): Pierce puede llegar aca con una zona placada — pega a mitad de
  // Fuerza en vez de fallar (targeting.js ya filtro esto para el Pierce normal, sin Certero).
  if (activeType === "pierce" && zone.plate > 0) {
    const before = zone.integrity;
    applyDamageToZone(defender, zoneName, Math.ceil(effFuerza / 2));
    return { plateChipped: false, integrityDamage: before - zone.integrity };
  }

  if (zone.plate <= 0) {
    // Blunt sin placa de por medio: "dano reducido" (doc §3.1) — solo se define fuerza COMPLETA
    // para el caso sin placa de Pierce/Cut; Blunt pega 2 (o 3 con Sismico) zonas, cada una a la
    // mitad.
    const dmg = activeType === "blunt" ? Math.ceil(effFuerza / 2) : effFuerza;
    const before = zone.integrity;
    applyDamageToZone(defender, zoneName, dmg);
    return { plateChipped: false, integrityDamage: before - zone.integrity };
  }

  // Placa intacta/agrietada:
  if (activeType === "cut") {
    zone.plate = Math.max(0, zone.plate - 1); // "el resto del golpe se pierde"
    tryRemachado(defender, zone);
    if (hasTrait(attacker, "brutal") && zone.plate <= 0) {
      // Brutal: ademas de romper la placa, pasa 1 de dano de todos modos.
      const before = zone.integrity;
      applyDamageToZone(defender, zoneName, 1);
      return { plateChipped: true, integrityDamage: before - zone.integrity };
    }
    if (hasTrait(attacker, "devastador")) {
      // Devastador: "el dano se aplica a la zona Y a la placa a la vez" — rompe la placa igual que
      // siempre, pero ADEMAS pasa el dano completo que Cut le haria a una zona desnuda, en vez de
      // perderlo. Contrapartida ya cobrada arriba (Alcance -1, ver targeting.js#effectiveReach).
      const before = zone.integrity;
      applyDamageToZone(defender, zoneName, effFuerza);
      return { plateChipped: true, integrityDamage: before - zone.integrity };
    }
    return { plateChipped: true, integrityDamage: 0 };
  }
  if (activeType === "blunt") {
    zone.plate = Math.max(0, zone.plate - 1);
    tryRemachado(defender, zone);
    // Devastador: el golpe "reducido" de Blunt (mitad de Fuerza) pasa entero en vez del fijo de 1.
    const dmg = hasTrait(attacker, "devastador") ? Math.ceil(effFuerza / 2) : 1; // fijo (doc §5.3), no escala con Fuerza salvo Devastador
    const before = zone.integrity;
    applyDamageToZone(defender, zoneName, dmg);
    return { plateChipped: true, integrityDamage: before - zone.integrity };
  }
  // pierce sin Certero nunca llega aca: selectTarget() solo le da zonas sin placa.
  return { plateChipped: false, integrityDamage: 0 };
}

function weakestLivingZone(battler) {
  const candidates = ZONES.filter((z) => battler.zones[z].integrity > 0);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (battler.zones[a].integrity <= battler.zones[b].integrity ? a : b));
}

/**
 * Resuelve el turno de `attacker`. Devuelve una descripcion del evento para el log del
 * simulador — nunca tira si no hay objetivo, simplemente no hace nada ("turno perdido", un dato
 * en si mismo para el balance).
 * @param {boolean} [nucleoShielded] - default false: si true, un golpe que hubiera llegado al
 *   Nucleo (por linea de tiro o tablero vacio) no le hace nada — se pierde entero, kind
 *   "nucleo_shielded". Pensado para un escudo temporal de X rondas al arrancar la partida (ver
 *   chat), como alternativa a graceRounds (que en vez de bloquear el golpe, aflojaba la regla de
 *   exposicion). Magic paga igual su costo de cabeza: el escudo protege al Nucleo, no vuelve
 *   gratis el hechizo.
 * @param {boolean} [magicFallbackActive] - default false: salta el corte de "cabeza rota => no
 *   puede lanzar Magic" — usado cuando el llamador (ver magicFallback.js) ya cobro el costo
 *   alternativo por Linaje ANTES de esta llamada (Impulso/Escombros/Iniciativa/Torso/drenar a un
 *   aliado, segun el Linaje). El costo normal de cabeza (1 de Integridad) se sigue aplicando mas
 *   abajo, pero como la cabeza ya esta en 0 es un no-op inofensivo (Math.max clamp) — no duplica
 *   penalizacion.
 * @param {number} [fuerzaBonus] - default 0: bonos de Fuerza que dependen de TOPOLOGIA de tablero
 *   (hoy solo el aura de "estandarte") — resolve.js no conoce el tablero propio del atacante, asi
 *   que el llamador lo calcula (ver board.js#estandarteBonusFor) y lo pasa ya resuelto.
 * @param {number} [fuerzaScale] - default 1: multiplicador sobre la Fuerza ya sumada (bonus
 *   incluido) — 0.5 para Gemelo/Frenetico ("cada golpe/accion con la mitad de Fuerza"), redondeado
 *   para arriba como el resto del daño reducido del motor (doc §3.1, mismo criterio que Blunt sin
 *   placa). Vive aca y no como una resta aparte para que Vengativo/Paciente (que ya suman a la
 *   Fuerza base) tambien queden a mitad cuando corresponda, en vez de escaparse del split.
 */
export function resolveAttack(attacker, defenderBoard, nucleo, lineOfSight = true, nucleoShielded = false, magicFallbackActive = false, fuerzaBonus = 0, fuerzaScale = 1) {
  if (attacker.activeType === "magic" && attacker.zones.head.integrity <= 0 && !magicFallbackActive) {
    return { kind: "no_magic_head_broken" };
  }

  const target = selectTarget(attacker, defenderBoard, lineOfSight);
  if (!target) return { kind: "no_target" };

  const fuerza = Math.ceil((effectiveFuerza(attacker) + fuerzaBonus) * fuerzaScale);

  if (attacker.activeType === "magic") {
    applyDamageToZone(attacker, "head", 1); // costo de lanzar (doc §3.1) — SIEMPRE, haya o no Nucleo de por medio
  }

  if (target.nucleo) {
    if (nucleoShielded) return { kind: "nucleo_shielded" };
    nucleo.hp = Math.max(0, nucleo.hp - fuerza);
    return { kind: "hit_nucleo", dmg: fuerza, nucleoHp: nucleo.hp };
  }

  const defender = defenderBoard[target.position];

  // Escurridizo (raro, defensor): al ser atacado por Pierce, esquiva entero — no hay zona
  // elegida, placa gastada ni progreso de ningun tipo, el golpe se pierde en el aire.
  if (attacker.activeType === "pierce" && hasTrait(defender, "escurridizo")) {
    return { kind: "dodged", position: target.position };
  }

  const hits = target.zones.map((zoneName) => ({
    zone: zoneName,
    ...hitZone(attacker, defender, zoneName, fuerza),
  }));
  const plateChipped = hits.some((h) => h.plateChipped);
  const integrityDamage = hits.reduce((sum, h) => sum + h.integrityDamage, 0);

  const result = {
    kind: "hit_unit",
    position: target.position,
    zones: target.zones,
    hits,
    plateChipped,
    integrityDamage,
    trueWaste: !plateChipped && integrityDamage === 0, // no paso NADA — ni daño ni progreso en la placa
    fell: defender.fallen,
  };

  // Reflejo (comun): si el defensor sobrevive, contraataca una vez por ronda — simplificado
  // (ignora placa del atacante, no dispara su propio Reflejo en cadena) para no anidar una
  // resolucion completa de resolveAttack dentro de otra.
  if (!defender.fallen && !defender.collapsed && hasTrait(defender, "reflejo") && !defender.reflejoUsedThisRound) {
    defender.reflejoUsedThisRound = true;
    const counterZone = weakestLivingZone(attacker);
    if (counterZone) {
      const counterFuerza = effectiveFuerza(defender);
      applyDamageToZone(attacker, counterZone, counterFuerza);
      result.reflejo = { zone: counterZone, dmg: counterFuerza, attackerFell: attacker.fallen };
    }
  }

  // Arrollador/Arponero (comunes): si el defensor sobrevivio, lo empujan o arrastran una posicion
  // (pushBattler ya respeta Inamovible/Baluarte y no hace nada si el casillero destino esta
  // ocupado o es el borde del tablero).
  if (!defender.fallen && !defender.collapsed) {
    if (hasTrait(attacker, "arrollador")) {
      const to = pushBattler(defenderBoard, target.position, 1);
      if (to !== null) result.pushed = { from: target.position, to };
    } else if (hasTrait(attacker, "arponero")) {
      const to = pushBattler(defenderBoard, target.position, -1);
      if (to !== null) result.pulled = { from: target.position, to };
    }
  }

  return result;
}

/** Sereno (raro): al final de la ronda, si no ataco, repone 1 de placa — como la placa nunca pasa
 * de 1 (doc §7.6/materiales), "reponer" es simplemente volver a poner en 1 la primera zona que
 * alguna vez tuvo placa y hoy esta en 0. Elige la primera en el orden de ZONES (desempate
 * arbitrario pero deterministico), no la "mas dañada" — con placa binaria no hay tal cosa. */
function restoreSerenoPlate(battler) {
  for (const z of ZONES) {
    const zone = battler.zones[z];
    if (zone.integrity > 0 && zone.everPlated && zone.plate <= 0) {
      zone.plate = 1;
      return;
    }
  }
}

/**
 * Rasgos que reaccionan a que el turno de `battler` NO haya conectado ningun ataque real
 * (no_target / no_magic_head_broken) — Paciente acumula Fuerza para la proxima vez, Sereno se
 * repara. Se llama una vez por turno, justo despues de resolveAttack, desde el orquestador (el
 * mismo llamador que ya loguea `result` — no vive dentro de resolveAttack para no acoplar el
 * "no until now hizo nada" con la resolucion del golpe en si).
 */
export function applyPostAttackTraits(battler, result) {
  const didNotAttack = result.kind === "no_target" || result.kind === "no_magic_head_broken";
  if (!didNotAttack) return;
  if (hasTrait(battler, "paciente")) battler.pacienteStacks = (battler.pacienteStacks || 0) + 2;
  if (hasTrait(battler, "sereno")) restoreSerenoPlate(battler);
}

/** Colapso (doc §4.3): ambos brazos rotos, o piernas + brazo principal rotos ("perdio las piernas
 * y todo lo que le permitia atacar a distancia" — interpretado aca como: sin piernas Y sin el
 * brazo principal, ya sea el de nacimiento o el que heredo al cambiar de mano). Se chequea en un
 * barrido aparte (Fase 5), no en el momento del golpe — un battler puede seguir "vivo" en el
 * tablero el resto de la ronda despues de quedar en condicion de Colapso. */
export function checkCollapse(battler) {
  if (battler.fallen || battler.collapsed) return false;
  const armsGone = battler.zones.armMain.integrity <= 0 && battler.zones.armOff.integrity <= 0;
  const legsAndMainGone = battler.zones.legs.integrity <= 0 && battler.zones.armMain.integrity <= 0;
  if (armsGone || legsAndMainGone) {
    battler.collapsed = true;
    return true;
  }
  return false;
}
