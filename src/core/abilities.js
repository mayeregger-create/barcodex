// src/core/abilities.js
// Efecto mecanico de las 10 habilidades especiales de data/abilities.js#ABILITIES, mas el
// sistema de CARGAS que decide cuando se usan (tanto habilidades como Parry): cada golpe que un
// battler DA lo acerca a una carga de Habilidad, cada golpe que RECIBE lo acerca a una carga de
// Parry. Reemplaza el enfoque anterior (heuristicas por HP/Energia, cooldowns por turno) —
// buscado a proposito: la decision es "¿tengo la carga?", no una apuesta situacional.
import { computeAttack, applyIncoming } from "./combat.js";

// Golpes para juntar 1 carga. Con 3, en un combate de ~8 acciones por lado (ver hpMax en
// character.js) cada bando ve un par de habilidades y un par de parries por combate — suficiente
// para sentirse presente sin ser lo unico que pasa.
const HITS_PER_PARRY_CHARGE = 3;
const HITS_PER_ABILITY_CHARGE = 3;
const MAX_PARRY_CHARGES = 1;
const MAX_ABILITY_CHARGES = 3; // = el costo de Golpe definitivo, el mas caro

// Golpe definitivo pide 3 cargas en vez de 1: sigue siendo el "ultimate" raro, pero con la misma
// moneda que el resto en vez de un medidor de Energia aparte.
function abilityCost(name) {
  return name === "Golpe definitivo" ? 3 : 1;
}

/** true si `battler` ya junto suficientes cargas para su propia habilidad. */
export function canUseAbility(battler) {
  return battler.abilityCharges >= abilityCost(battler.character.habilidad.name);
}

/** true si conviene armar Parry este turno: unicamente si hay una carga lista y no esta ya
 * armado (armar es la accion del turno — igual que antes, solo que ahora es "gastar la carga",
 * no una apuesta sobre el daño estimado del rival). */
export function shouldParry(battler) {
  return battler.parryCharges > 0 && !battler.parryArmed;
}

/** Decide la accion de `battler` este turno: "ability" | "parry" | "attack". Ya no mira al
 * rival — con cargas fijas, la decision es interna, no situacional. */
export function decideAction(battler) {
  if (canUseAbility(battler)) return "ability";
  if (shouldParry(battler)) return "parry";
  return "attack";
}

/** Registra un golpe RECIBIDO por `battler`: cada 3, una carga de Parry (tope 1). */
export function registerHitTaken(battler) {
  let hitsTaken = (battler.hitsTaken || 0) + 1;
  let parryCharges = battler.parryCharges || 0;
  if (hitsTaken >= HITS_PER_PARRY_CHARGE) {
    hitsTaken -= HITS_PER_PARRY_CHARGE;
    parryCharges = Math.min(MAX_PARRY_CHARGES, parryCharges + 1);
  }
  return { ...battler, hitsTaken, parryCharges };
}

/** Registra un golpe DADO por `battler`: cada 3, una carga de Habilidad (tope 3). `bonus` suma
 * cargas extra de una sola vez (ej. el "afin" de Parry, o Drenaje). */
export function registerHitDealt(battler, bonus = 0) {
  let hitsDealt = (battler.hitsDealt || 0) + 1;
  let abilityCharges = battler.abilityCharges || 0;
  while (hitsDealt >= HITS_PER_ABILITY_CHARGE) {
    hitsDealt -= HITS_PER_ABILITY_CHARGE;
    abilityCharges = Math.min(MAX_ABILITY_CHARGES, abilityCharges + 1);
  }
  if (bonus > 0) abilityCharges = Math.min(MAX_ABILITY_CHARGES, abilityCharges + bonus);
  return { ...battler, hitsDealt, abilityCharges };
}

/** Suma cargas de Habilidad sin que haya golpe de por medio (bonus puro, ej. bloqueo afin). */
export function grantAbilityCharge(battler, amount = 1) {
  return { ...battler, abilityCharges: Math.min(MAX_ABILITY_CHARGES, (battler.abilityCharges || 0) + amount) };
}

/** Un golpe dentro de una habilidad: igual que un ataque normal (rueda + critico + Resistencia)
 * con un multiplicador propio, pasando por el estado defensivo puntual del que lo recibe
 * (Paso fantasma / Piel de corteza). Devuelve el daño final ya aplicable a HP. */
function resolveHit(attacker, defenderStatus, defenderForCalc, mult) {
  const { dmg: rawDmg, isCrit } = computeAttack(attacker, defenderForCalc, mult);
  const { dmg, dodged, halved, status } = applyIncoming(defenderStatus, rawDmg);
  return { dmg, isCrit, dodged, halved, status };
}

/**
 * Ejecuta la habilidad de `attacker` contra `defender` (ya se confirmo que hay carga suficiente
 * — ver canUseAbility). Devuelve los battlers actualizados (nunca muta los originales), las
 * lineas de log, y `events` para la ayuda visual (ver CombatFx.jsx).
 */
export function applyAbility(attacker, defender) {
  const name = attacker.character.habilidad.name;
  let newAttacker = { ...attacker, status: { ...attacker.status } };
  let newDefender = { ...defender, status: { ...defender.status } };
  const log = [];
  const events = [{ role: "actor", kind: "actor", action: "ability" }];

  const dealDamage = (mult) => {
    const { dmg, isCrit, dodged, halved, status } = resolveHit(newAttacker, newDefender.status, newDefender, mult);
    newDefender.status = status;
    newDefender.hp = Math.max(0, newDefender.hp - dmg);
    if (dodged) {
      events.push({ role: "target", kind: "dodge" });
    } else {
      events.push({ role: "target", kind: "damage", amount: dmg, source: "ability" });
      newDefender = registerHitTaken(newDefender);
      newAttacker = registerHitDealt(newAttacker);
    }
    return { dmg, isCrit, dodged, halved };
  };

  switch (name) {
    case "Golpe veloz": {
      let total = 0, anyCrit = false;
      for (let i = 0; i < 2; i++) {
        const { dmg, isCrit } = dealDamage(0.6);
        total += dmg;
        anyCrit = anyCrit || isCrit;
      }
      log.push(`${attacker.character.nombre} usa Golpe veloz: dos golpes, ${total} de daño en total${anyCrit ? " (¡crítico!)" : ""}.`);
      break;
    }
    case "Golpe certero": {
      const bonus = attacker.stats.Velocidad > defender.stats.Velocidad ? 1.3 : 1;
      const { dmg, isCrit } = dealDamage(bonus);
      log.push(`${attacker.character.nombre} usa Golpe certero por ${dmg}${isCrit ? " (¡crítico!)" : ""}.`);
      break;
    }
    case "Piel de corteza": {
      newAttacker.status.halfDmgNext = true;
      log.push(`${attacker.character.nombre} usa Piel de corteza: el próximo golpe que reciba se reduce a la mitad.`);
      break;
    }
    case "Drenaje": {
      // Sin medidor de Energia ya no "carga" nada aparte — en cambio pega un poco mas fuerte y
      // regala una carga de Habilidad extra, para conservar el gancho "vampirico" original.
      const { dmg, isCrit } = dealDamage(1.15);
      newAttacker = grantAbilityCharge(newAttacker, 1);
      log.push(`${attacker.character.nombre} usa Drenaje: ${dmg} de daño${isCrit ? " (¡crítico!)" : ""}, +1 carga de Habilidad.`);
      break;
    }
    case "Grito de guerra": {
      newAttacker.status.fuerzaBuff = (newAttacker.status.fuerzaBuff || 0) + 3;
      log.push(`${attacker.character.nombre} lanza un Grito de guerra: +3 Fuerza el resto del combate.`);
      break;
    }
    case "Paso fantasma": {
      newAttacker.status.dodgeNext = true;
      log.push(`${attacker.character.nombre} usa Paso fantasma: esquivará el próximo ataque.`);
      break;
    }
    case "Fortuna del mercader": {
      if (Math.random() < 0.5) {
        const { dmg, isCrit } = dealDamage(2);
        log.push(`${attacker.character.nombre} arriesga con Fortuna del mercader: ¡doble daño, ${dmg}!${isCrit ? " (¡crítico!)" : ""}`);
      } else {
        log.push(`${attacker.character.nombre} arriesga con Fortuna del mercader... y pierde el turno.`);
        events.push({ role: "actor", kind: "miss" });
      }
      break;
    }
    case "Regeneración": {
      newAttacker.status.regenTurnsLeft = 3;
      newAttacker.status.regenAmount = Math.max(1, Math.round(attacker.character.hpMax * 0.08));
      log.push(`${attacker.character.nombre} activa Regeneración: se curará por 3 turnos.`);
      break;
    }
    case "Grito paralizante": {
      newDefender.status.paralized = true;
      log.push(`${attacker.character.nombre} lanza un Grito paralizante: ${defender.character.nombre} pierde su próxima acción.`);
      break;
    }
    case "Golpe definitivo": {
      const { dmg, isCrit } = dealDamage(2.2);
      log.push(`${attacker.character.nombre} descarga su Golpe definitivo por ${dmg}${isCrit ? " (¡crítico!)" : ""}.`);
      break;
    }
    default:
      break;
  }

  newAttacker.abilityCharges -= abilityCost(name);
  return { attacker: newAttacker, defender: newDefender, log, events };
}

/**
 * Se llama al empezar el turno de `battler`, antes de decidir accion: consume la paralisis (si
 * esta activa, pierde el turno entero) y aplica Regeneracion.
 */
export function tickTurnStart(battler) {
  let next = { ...battler, status: { ...battler.status } };
  const log = [];
  const events = [];

  if (next.status.paralized) {
    next.status.paralized = false;
    log.push(`${next.character.nombre} está paralizado y pierde su turno.`);
    events.push({ role: "self", kind: "paralized" });
    return { battler: next, skip: true, log, events };
  }

  if (next.status.regenTurnsLeft > 0) {
    const heal = next.status.regenAmount;
    next.hp = Math.min(next.character.hpMax, next.hp + heal);
    next.status.regenTurnsLeft -= 1;
    log.push(`${next.character.nombre} se regenera ${heal} HP.`);
    events.push({ role: "self", kind: "heal", amount: heal });
  }

  return { battler: next, skip: false, log, events };
}
