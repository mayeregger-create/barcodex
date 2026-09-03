// src/combat/nucleoAbilities.js
// Primera habilidad activada del Nucleo, pagada con Escombros — hasta ahora Escombros solo se
// gastaba en la salida de Magic de Marea (magicFallback.js); esto le da un uso propio al recurso,
// calibrado contra los datos reales de acumulacion medidos en el chat (media ~2.2, maximo visto 7
// en partidas de mazos de 5 cartas — ver reportEconomy.mjs).
import { POSITIONS } from "./board.js";
import { ZONES } from "../cardgen/zones.js";

export const REPARAR_COST = 2;

/** La zona VIVA mas dañada (mayor diferencia entre la Integridad de generacion y la actual) de
 * todo un bando — null si nadie esta dañado. No repara zonas ya rotas (integrity 0): eso es
 * "resucitar", no reparar. */
export function findMostDamaged(board) {
  let best = null;
  for (const p of POSITIONS) {
    const b = board[p];
    if (!b || b.fallen || b.collapsed) continue;
    for (const z of ZONES) {
      const zone = b.zones[z];
      if (zone.integrity <= 0) continue;
      const missing = b.card.zones[z].integrity - zone.integrity;
      if (missing > 0 && (!best || missing > best.missing)) {
        best = { position: p, zone: z, missing };
      }
    }
  }
  return best;
}

/**
 * Repara 1 de Integridad a la zona viva mas dañada del bando, si hay Escombros suficientes y algo
 * que reparar. Muta `board`/`escombros`.
 * @returns {false | { position: number, zone: string, name: string }}
 */
export function tryReparar(board, escombros, side) {
  if (escombros[side] < REPARAR_COST) return false;
  const target = findMostDamaged(board);
  if (!target) return false;
  escombros[side] -= REPARAR_COST;
  const battler = board[target.position];
  battler.zones[target.zone].integrity += 1;
  return { position: target.position, zone: target.zone, name: battler.card.identity.name };
}
