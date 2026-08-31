// src/combat/resolve.js
// Aplica un ataque: daño a zona/placa segun tipo (doc §5.3), cascada de zona rota (§4.1), costo
// de Magic (§3.1), daño a Nucleo. Muta los battlers/Nucleo directo (simulador headless, no el
// modelo inmutable de la UI real) — mas simple para correr miles de partidas rapido.
import { DAMAGE_TYPES } from "../cardgen/classGen.js";
import { selectTarget } from "./targeting.js";

export function effectiveFuerza(battler) {
  return Math.min(battler.strength, DAMAGE_TYPES[battler.activeType].fuerzaTope + 2);
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
      battler.strength = Math.max(0, battler.strength - 2); // doc §4.2
    }
  }
  // armOff/legs: sin efecto numerico modelado aca (bonus de clase / movimiento no estan en esta
  // primera pasada) — solo importan para el chequeo de Colapso, ver checkCollapse() abajo.
}

function applyDamageToZone(defender, zoneName, dmg) {
  const zone = defender.zones[zoneName];
  const wasAlive = zone.integrity > 0;
  zone.integrity = Math.max(0, zone.integrity - dmg);
  if (wasAlive && zone.integrity <= 0) {
    zone.broken = true;
    zone.hitsToBreak = zone.hitsTaken; // snapshot para el reporte de balance (§17.3)
    applyZoneBreakCascade(defender, zoneName);
  }
}

/**
 * Un golpe contra UNA zona, respetando placa segun tipo (doc §5.3). Devuelve que paso REALMENTE
 * en este golpe — antes esto se inferia comparando la suma de Integridad del tablero antes/despues,
 * lo que mezclaba "rompio 1 de Placa mientras Cut hacia su trabajo" con "no paso nada" bajo el
 * mismo balde de "cero dano" — son cosas distintas (una es la mecanica funcionando, la otra un
 * verdadero golpe en el aire), asi que ahora se distinguen en el origen del dato.
 * @returns {{ plateChipped: boolean, integrityDamage: number }}
 */
function hitZone(defender, zoneName, activeType, fuerza) {
  const zone = defender.zones[zoneName];
  zone.hitsTaken = (zone.hitsTaken || 0) + 1; // instrumentacion para "cuantos golpes para romper" (§17.3)

  if (activeType === "magic") {
    const before = zone.integrity;
    applyDamageToZone(defender, zoneName, fuerza); // ignora la placa por completo
    return { plateChipped: false, integrityDamage: before - zone.integrity };
  }

  if (zone.plate <= 0) {
    // Blunt sin placa de por medio: "dano reducido" (doc §3.1) — solo se define fuerza COMPLETA
    // para el caso sin placa de Pierce/Cut; Blunt pega 2 zonas, cada una a la mitad.
    const dmg = activeType === "blunt" ? Math.ceil(fuerza / 2) : fuerza;
    const before = zone.integrity;
    applyDamageToZone(defender, zoneName, dmg);
    return { plateChipped: false, integrityDamage: before - zone.integrity };
  }

  // Placa intacta/agrietada:
  if (activeType === "cut") {
    zone.plate = Math.max(0, zone.plate - 1); // "el resto del golpe se pierde"
    return { plateChipped: true, integrityDamage: 0 };
  }
  if (activeType === "blunt") {
    zone.plate = Math.max(0, zone.plate - 1);
    const before = zone.integrity;
    applyDamageToZone(defender, zoneName, 1); // fijo (doc §5.3), no escala con Fuerza
    return { plateChipped: true, integrityDamage: before - zone.integrity };
  }
  // pierce nunca llega aca: selectTarget() solo le da zonas sin placa.
  return { plateChipped: false, integrityDamage: 0 };
}

/**
 * Resuelve el turno de `attacker`. Devuelve una descripcion del evento para el log del
 * simulador — nunca tira si no hay objetivo, simplemente no hace nada ("turno perdido", un dato
 * en si mismo para el balance).
 */
export function resolveAttack(attacker, defenderBoard, nucleo, lineOfSight = true) {
  if (attacker.activeType === "magic" && attacker.zones.head.integrity <= 0) {
    return { kind: "no_magic_head_broken" };
  }

  const target = selectTarget(attacker.activeType, defenderBoard, lineOfSight);
  if (!target) return { kind: "no_target" };

  const fuerza = effectiveFuerza(attacker);

  if (attacker.activeType === "magic") {
    applyDamageToZone(attacker, "head", 1); // costo de lanzar (doc §3.1) — SIEMPRE, haya o no Nucleo de por medio
  }

  if (target.nucleo) {
    nucleo.hp = Math.max(0, nucleo.hp - fuerza);
    return { kind: "hit_nucleo", dmg: fuerza, nucleoHp: nucleo.hp };
  }

  const defender = defenderBoard[target.position];
  const hits = target.zones.map((zoneName) => ({
    zone: zoneName,
    ...hitZone(defender, zoneName, attacker.activeType, fuerza),
  }));
  const plateChipped = hits.some((h) => h.plateChipped);
  const integrityDamage = hits.reduce((sum, h) => sum + h.integrityDamage, 0);

  return {
    kind: "hit_unit",
    position: target.position,
    zones: target.zones,
    hits,
    plateChipped,
    integrityDamage,
    trueWaste: !plateChipped && integrityDamage === 0, // no paso NADA — ni daño ni progreso en la placa
    fell: defender.fallen,
  };
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
