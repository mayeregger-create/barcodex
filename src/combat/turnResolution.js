// src/combat/turnResolution.js
// Resuelve UN turno de la cola de la ronda de punta a punta: intenta la salida de Magic por
// Linaje si hace falta (magicFallback.js), calcula el aura de Estandarte (board.js), llama a
// resolveAttack y aplica Paciente/Sereno post-turno (resolve.js) — y repite ese golpe cuando
// corresponde por Gemelo (2 golpes en el mismo turno, mitad de Fuerza cada uno) o Implacable (un
// golpe extra a Fuerza completa, solo si el anterior rompio una zona, 1 vez por ronda). Frenetico
// ("actua dos veces por ronda") NO vive aca: se resuelve dandole 2 entradas en la cola de turno,
// ver simulate.js#buildTurnOrder — cada una de esas 2 entradas pasa por resolveTurn() UNA vez, con
// la mitad de Fuerza.
//
// Vive en un modulo aparte porque tanto simulateEconomy.js como BoardPrototype.jsx necesitaban
// exactamente esta secuencia y antes vivia duplicada en los dos — con el riesgo real de
// desincronizarse (ya paso una vez con el orden de turno, ver buildTurnOrder en simulate.js).
import { estandarteBonusFor } from "./board.js";
import { resolveAttack, applyPostAttackTraits } from "./resolve.js";
import { attemptMagicFallback } from "./magicFallback.js";
import { hasTrait } from "./traits.js";

function zoneBrokeThisHit(result, defBoard) {
  if (result.kind !== "hit_unit") return false;
  const defender = defBoard[result.position];
  return result.zones.some((z) => defender.zones[z].integrity <= 0);
}

/** Un solo golpe, con todo el ritual de alrededor (salida de Magic, aura, post-turno). `scale`
 * multiplica la Fuerza efectiva (0.5 para Gemelo/Fenetico, 1 en cualquier otro caso). */
function performOneSwing(battler, side, ctx, scale) {
  let magicFallbackActive = false;
  let fallbackKind = null;
  let fallbackAttempted = false;

  if (battler.activeType === "magic" && battler.zones.head.integrity <= 0) {
    fallbackAttempted = true;
    const applied = attemptMagicFallback(battler, side, {
      impulsoAvailable: ctx.getImpulso(),
      escombrosAvailable: ctx.escombros[side],
      ownBoard: ctx.ownBoard,
    });
    if (applied.ok) {
      if (applied.impulsoSpent) ctx.spendImpulso(applied.impulsoSpent);
      if (applied.escombrosSpent) ctx.escombros[side] -= applied.escombrosSpent;
      if (applied.kind === "cantera_torso" && applied.lethal) battler.strength += 2; // el ultimo hechizo pega mas fuerte
      magicFallbackActive = true;
      fallbackKind = applied.kind;
    }
  }

  const fuerzaBonus = estandarteBonusFor(battler, ctx.ownBoard);
  const result = resolveAttack(
    battler,
    ctx.defBoard,
    ctx.defNucleo,
    ctx.lineOfSight,
    ctx.round <= ctx.nucleoShieldRounds,
    magicFallbackActive,
    fuerzaBonus,
    scale
  );
  applyPostAttackTraits(battler, result);
  return { ...result, magicFallbackKind: fallbackKind, magicFallbackAttempted: fallbackAttempted };
}

/**
 * @param {object} battler
 * @param {"A"|"B"} side
 * @param {{ ownBoard: object, defBoard: object, defNucleo: {hp:number}, escombros: {A:number,B:number},
 *   getImpulso: () => number, spendImpulso: (n:number) => void, round: number,
 *   nucleoShieldRounds: number, lineOfSight: boolean }} ctx
 * @returns {object[]} uno o mas resultados de resolveAttack (mas de uno con Gemelo/Implacable),
 *   cada uno con `magicFallbackKind`/`magicFallbackAttempted` adjuntos.
 */
export function resolveTurn(battler, side, ctx) {
  const swings = hasTrait(battler, "gemelo") ? 2 : 1;
  const scale = swings === 2 || hasTrait(battler, "frenetico") ? 0.5 : 1;
  const results = [];

  for (let i = 0; i < swings; i++) {
    if (battler.fallen || battler.collapsed) break; // un golpe anterior (Reflejo, costo de Magic) pudo tumbarlo

    const result = performOneSwing(battler, side, ctx, scale);
    results.push(result);

    // Implacable: si ESTE golpe rompio una zona y todavia no lo uso esta ronda, ataca de nuevo a
    // Fuerza COMPLETA (no es un "swing" de Gemelo, es una condicion aparte y no se reduce).
    if (
      !battler.fallen &&
      !battler.collapsed &&
      hasTrait(battler, "implacable") &&
      !battler.implacableUsedThisRound &&
      zoneBrokeThisHit(result, ctx.defBoard)
    ) {
      battler.implacableUsedThisRound = true;
      results.push(performOneSwing(battler, side, ctx, 1));
    }
  }

  return results;
}
