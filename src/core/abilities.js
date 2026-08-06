// src/core/abilities.js
// Efecto mecanico + condicion de disparo automatico para las 10 habilidades especiales de
// data/abilities.js#ABILITIES. Cada personaje tiene UNA sola (indexada por el digito
// verificador, ver character.js), asi que la decision por turno es siempre binaria: "conviene
// activar la habilidad de este battler ahora mismo?" — no hay que priorizar entre varias.
//
// Funciones puras: reciben battlers (forma en CombatScreen.jsx#makeSide, con .status/.energy/
// .abilityCooldown/.abilityUsedOnce agregados) y devuelven copias nuevas + lineas de log.
import { baseDamage, computeAttack, effectiveDefensa, applyIncoming } from "./combat.js";
import { wheelModifier } from "./squad.js";

export const ENERGY_MAX = 10;

const ONCE = "once";

// Turnos de enfriamiento tras usarse (propios de ese battler, no del reloj global) — "once" =
// solo una vez por combate. Golpe definitivo no tiene enfriamiento: lo bloquea necesitar la
// Energia llena, que ya tarda varios turnos en cargarse.
const COOLDOWN = {
  "Golpe veloz": 2,
  "Golpe certero": 2,
  "Piel de corteza": 3,
  "Drenaje": 2,
  "Grito de guerra": ONCE,
  "Paso fantasma": 3,
  "Fortuna del mercader": 3,
  "Regeneración": 4,
  "Grito paralizante": 4,
  "Golpe definitivo": 0,
};

function effectiveFuerza(battler) {
  return battler.stats.Fuerza + (battler.status.fuerzaBuff || 0);
}

/** Estimacion determinista (sin critico ni RNG) de cuanto haria un ataque normal — solo para
 * decidir triggers, nunca para aplicar daño real (eso siempre pasa por computeAttack). */
function estimateDamage(attacker, defender) {
  const dmgMod = wheelModifier(attacker.character.continente, defender.character.continente).dmgMod;
  return baseDamage(effectiveFuerza(attacker), effectiveDefensa(defender)) * dmgMod;
}

export function canUseAbility(battler) {
  const name = battler.character.habilidad.name;
  if (name === "Golpe definitivo") return battler.energy >= ENERGY_MAX;
  const cd = COOLDOWN[name];
  if (cd === ONCE) return !battler.abilityUsedOnce;
  return battler.abilityCooldown <= 0;
}

/** true si conviene activar la habilidad de `battler` este turno, dado el estado de `opponent`. */
function abilityWants(battler, opponent) {
  if (!canUseAbility(battler)) return false;
  const hpPct = battler.hp / battler.character.hpMax;
  switch (battler.character.habilidad.name) {
    case "Golpe veloz":
    case "Golpe certero":
    case "Grito de guerra":
    case "Golpe definitivo":
      return true; // el gate de cooldown/energia/"once" ya filtra cuando no corresponde
    case "Drenaje":
      return battler.energy < ENERGY_MAX;
    case "Piel de corteza":
      return hpPct < 0.35;
    case "Paso fantasma":
      return hpPct < 0.3;
    case "Fortuna del mercader":
      return hpPct < opponent.hp / opponent.character.hpMax - 0.15;
    case "Regeneración":
      return hpPct >= 0.2 && hpPct <= 0.6;
    case "Grito paralizante":
      return estimateDamage(opponent, battler) >= battler.hp * 0.25;
    default:
      return false;
  }
}

/** true si conviene armar Parry este turno: se juega antes de ver la accion del rival, asi que
 * es una apuesta sobre cuanto daño estimado recibiria si el rival ataca. */
export function shouldParry(battler, opponent) {
  if (battler.parryArmed) return false;
  return estimateDamage(opponent, battler) >= battler.hp * 0.3;
}

/** Decide la accion de `battler` este turno: "ability" | "parry" | "attack". */
export function decideAction(battler, opponent) {
  if (abilityWants(battler, opponent)) return "ability";
  if (shouldParry(battler, opponent)) return "parry";
  return "attack";
}

/** Un golpe dentro de una habilidad: igual que un ataque normal (rueda + critico + Resistencia)
 * con un multiplicador propio, pasando por el estado defensivo puntual del que lo recibe
 * (Paso fantasma / Piel de corteza). Devuelve el daño final ya aplicable a HP. */
function resolveHit(attacker, defenderStatus, defenderForCalc, mult) {
  const { dmg: rawDmg, isCrit } = computeAttack(attacker, defenderForCalc, mult);
  const { dmg, dodged, halved, status } = applyIncoming(defenderStatus, rawDmg);
  return { dmg, isCrit, dodged, halved, status };
}

function setCooldown(battler, name) {
  const cd = COOLDOWN[name];
  if (cd === ONCE) return { ...battler, abilityUsedOnce: true };
  if (typeof cd === "number" && cd > 0) return { ...battler, abilityCooldown: cd };
  return battler;
}

/**
 * Ejecuta la habilidad de `attacker` contra `defender`. Devuelve los battlers actualizados
 * (nunca muta los originales) + las lineas de log a agregar.
 */
export function applyAbility(attacker, defender) {
  const name = attacker.character.habilidad.name;
  let newAttacker = { ...attacker, status: { ...attacker.status } };
  let newDefender = { ...defender, status: { ...defender.status } };
  const log = [];
  // "role" en vez de side/idx: applyAbility no sabe en que posicion del equipo esta cada uno,
  // eso lo agrega quien la llama (CombatScreen.jsx#performAction), que si lo sabe.
  const events = [{ role: "actor", kind: "actor", action: "ability" }];

  const dealDamage = (mult) => {
    const { dmg, isCrit, dodged, halved, status } = resolveHit(newAttacker, newDefender.status, newDefender, mult);
    newDefender.status = status;
    newDefender.hp = Math.max(0, newDefender.hp - dmg);
    if (dodged) {
      events.push({ role: "target", kind: "dodge" });
    } else {
      events.push({ role: "target", kind: "damage", amount: dmg, source: "ability" });
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
      const { dmg, isCrit, dodged } = dealDamage(1);
      const gain = dodged ? 0 : Math.max(1, Math.round(dmg * 0.35));
      newAttacker.energy = Math.min(ENERGY_MAX, newAttacker.energy + gain);
      log.push(`${attacker.character.nombre} usa Drenaje: ${dmg} de daño${isCrit ? " (¡crítico!)" : ""}, +${gain} Energía.`);
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
      newAttacker.energy = 0;
      log.push(`${attacker.character.nombre} descarga su Golpe definitivo por ${dmg}${isCrit ? " (¡crítico!)" : ""}.`);
      break;
    }
    default:
      break;
  }

  newAttacker = setCooldown(newAttacker, name);
  return { attacker: newAttacker, defender: newDefender, log, events };
}

/**
 * Se llama al empezar el turno de `battler`, antes de decidir accion: consume la paralisis (si
 * esta activa, pierde el turno entero), aplica Regeneracion y la Energia pasiva del buff de
 * escuadron (ver squad.js#analyzeSquad — "afin" da +1 Energia/turno), y baja el cooldown propio.
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

  if (next.buff.energia > 0) {
    next.energy = Math.min(ENERGY_MAX, next.energy + next.buff.energia);
  }

  if (next.abilityCooldown > 0) next.abilityCooldown -= 1;

  return { battler: next, skip: false, log, events };
}
