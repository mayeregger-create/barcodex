// src/combat/magicFallback.js
// Salida de Magic tras romperse la cabeza, distinta por Linaje — decision aprobada en el chat
// ("me gusta") pero sin implementar hasta ahora. Antes, cabeza rota apagaba Magic para siempre (un
// loop que se autodestruye: la cabeza rota TAMBIEN prohibia seguir lanzando). Cada Linaje paga un
// costo alternativo en su lugar:
//
//   Fundicion -> pierde Iniciativa (acumulativo, sin tope) — su rasgo base ya gira en Iniciativa.
//   Injerto   -> drena 1 de Integridad de cabeza de un aliado ADYACENTE (posicion +-1) — "Voraz" ya
//               es alimentarse de otro cuerpo. Sin aliado adyacente con cabeza intacta, falla.
//   Marea     -> consume 1 Escombro — la marea arrastra los escombros a la orilla. Sin Escombros,
//               falla.
//   Prensa    -> consume 1 Impulso (el recurso del turno) — la mas industrial/economica de las 5.
//               Sin Impulso, falla.
//   Cantera   -> pasa a consumir el propio Torso (1 de Integridad). Si eso mata a la unidad, ESTE
//               ultimo hechizo pega +2 Fuerza (conecta con "Macizo": puede sobrevivir el golpe que
//               lo mataria, pero aca es la version ofensiva del mismo linaje). Nunca falla — es la
//               unica salida que consume la vida propia de la unidad en vez de un recurso externo.
//
// Si el Linaje no tiene salida (no deberia pasar, los 5 Linajes existentes ya tienen una) o la
// salida requiere un recurso que no esta disponible, `attemptMagicFallback` devuelve `{ok:false}`
// y el llamador debe tratarlo igual que "no_magic_head_broken".
import { POSITIONS } from "./board.js";
import { applyDamageToZone } from "./resolve.js";

function findAdjacentAllyWithHead(attacker, ownBoard) {
  const myPos = POSITIONS.find((p) => ownBoard[p] === attacker);
  if (myPos === undefined) return null;
  for (const p of [myPos - 1, myPos + 1]) {
    if (!POSITIONS.includes(p)) continue;
    const ally = ownBoard[p];
    if (ally && ally !== attacker && !ally.fallen && !ally.collapsed && ally.zones.head.integrity > 0) return ally;
  }
  return null;
}

/**
 * @param {object} attacker - battler cuya cabeza ya esta rota y quiere lanzar Magic igual.
 * @param {"A"|"B"} side - de que lado es `attacker`, para leer su propio Impulso/Escombros.
 * @param {{ impulsoAvailable: number, escombrosAvailable: number, ownBoard: object }} ctx
 * @returns {{ ok: boolean, kind?: string, impulsoSpent?: number, escombrosSpent?: number,
 *   lethal?: boolean, allyName?: string }} - deltas para que el llamador los aplique a SU propio
 *   estado (esta funcion no muta Impulso/Escombros directamente, solo al `attacker`/aliado cuando
 *   corresponde — mismo principio que economy.js: el motor no es dueño de esos recursos).
 */
export function attemptMagicFallback(attacker, side, { impulsoAvailable, escombrosAvailable, ownBoard }) {
  const linaje = attacker.card.lineage;

  if (linaje === "fundicion") {
    attacker.initiative -= 1;
    return { ok: true, kind: "fundicion_iniciativa" };
  }

  if (linaje === "prensa") {
    if (impulsoAvailable < 1) return { ok: false };
    return { ok: true, kind: "prensa_impulso", impulsoSpent: 1 };
  }

  if (linaje === "marea") {
    if (escombrosAvailable < 1) return { ok: false };
    return { ok: true, kind: "marea_escombros", escombrosSpent: 1 };
  }

  if (linaje === "injerto") {
    const ally = findAdjacentAllyWithHead(attacker, ownBoard);
    if (!ally) return { ok: false };
    applyDamageToZone(ally, "head", 1);
    return { ok: true, kind: "injerto_drena", allyName: ally.card.identity.name };
  }

  if (linaje === "cantera") {
    const wasAlive = attacker.zones.torso.integrity > 0;
    applyDamageToZone(attacker, "torso", 1);
    const lethal = wasAlive && attacker.zones.torso.integrity <= 0;
    return { ok: true, kind: "cantera_torso", lethal };
  }

  return { ok: false };
}
