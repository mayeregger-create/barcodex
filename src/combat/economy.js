// src/combat/economy.js
// Impulso (recurso de despliegue) y Escombros (recurso de combate), mas la inversion de Regente —
// extension discutida en el chat, todavia NO parte del documento "Sistema de juego" fijado: vive
// aca, separada de board.js/resolve.js/simulate.js, para poder medir el ritmo con el simulador
// antes de proponerla como regla.
//
// Decisiones de diseno tomadas en el chat (ver memoria del proyecto):
//  - Impulso arranca en 1 y suma +1 cada ronda ANTES de comprometer cartas (queda en 2 al llegar a
//    la ronda 1, tal como ya lo anticipaba el comentario de cost.js). No se resetea al gastar: lo
//    que sobra se banquea, pero el tope (=IMPULSO_CAP) crece a la misma velocidad que el ingreso,
//    asi que ahorrar da como mucho 1-2 rondas de margen, nunca un banco infinito.
//  - Escombros se generan al perder una unidad PROPIA (colapso o caida), proporcionales a su
//    Coste — perder algo caro deja mas material que perder algo barato. Van al bando DUEÑO de la
//    unidad perdida (recuperar el propio material, no botin del rival), para no premiar encima al
//    bando que ya va ganando.
//  - El Regente es la carta mas cara del mazo (heuristica del simulador headless; el juego real lo
//    deja a eleccion del jugador antes de la partida) y se despliega gratis en la ronda 1, sin
//    pagar Impulso — no es "una carta mas de la mano", es el comandante ya invertido.
import { ZONES } from "../cardgen/zones.js";
import { cardHasTrait } from "./traits.js";

export const IMPULSO_CAP = 8; // coincide con el Coste maximo (doc §10) — arriba de esto, bankear no suma nada
export const IMPULSO_START = 1; // antes del +1 de la ronda 1; con ese incremento queda en 2
export const NUCLEO_SHIELD_ROUNDS = 3; // adoptado en el chat — ver simulateEconomy.js para el porque

export function gainImpulso(current) {
  return Math.min(current + 1, IMPULSO_CAP);
}

/** round(Coste/3), minimo 1 — perder una unidad de Coste 1-4 deja 1 Escombro, Coste 6 deja 2,
 * Coste 8 deja 3. */
export function escombrosFromLoss(cost) {
  return Math.max(1, Math.round(cost / 3));
}

/** Elige Regente: la carta mas cara del mazo (primer empate gana). Devuelve { regente, hand } sin
 * mutar `deck`. */
export function pickRegente(deck) {
  let bestIdx = 0;
  for (let i = 1; i < deck.length; i++) {
    if (deck[i].cost > deck[bestIdx].cost) bestIdx = i;
  }
  const regente = deck[bestIdx];
  const hand = deck.filter((_, i) => i !== bestIdx);
  return { regente, hand };
}

/** Bono de Integridad de torso del Regente que se suma al Nucleo base (board.js documenta este
 * bono como pendiente: "el Nucleo arranca en un flat de 8, sin el bonus... del Regente"). Una
 * fraccion (÷4) para que sea un empujon, no una duplicacion del HP del Nucleo. */
export function nucleoBonusFromRegente(regenteCard) {
  return Math.round(regenteCard.zones[ZONES[1]].integrity / 4); // ZONES[1] = "torso"
}

/** Rasgo "abastecedor": otorga 1 Escombro al bando en el instante en que la carta se despliega
 * (tablero o Reserva, da igual — lo que importa es que dejo la mano). Cada sitio de despliegue
 * (Regente, commitFromHand, un click manual del jugador) llama a esto una vez por carta. */
export function escombrosFromDeploy(card) {
  return cardHasTrait(card, "abastecedor") ? 1 : 0;
}

/** Rasgo "leal": si la carta es de la misma Clase que el Regente del propio bando, su Coste de
 * despliegue baja 2 (minimo 1) — el Coste de generacion (`card.cost`) no cambia, esto es solo lo
 * que realmente se le cobra al Impulso. `regenteClass` puede ser null/undefined (todavia no hay
 * Regente, o el llamador no lo trackea) — en ese caso nunca aplica. */
export function effectiveDeployCost(card, regenteClass) {
  if (regenteClass && cardHasTrait(card, "leal") && card.identity.class === regenteClass) {
    return Math.max(1, card.cost - 2);
  }
  return card.cost;
}

/**
 * Compromete cartas de la mano a la Reserva mientras alcance el Impulso disponible esta ronda —
 * greedy "la mas cara que entre primero" (por Coste EFECTIVO, ver effectiveDeployCost), para
 * curvear hacia arriba cada ronda en vez de gastar en cartas chicas y desperdiciar el resto. No
 * toca el tablero: el llamador ubica cada carta comprometida con placeCard().
 * @param {string} [regenteClass] - Clase del Regente propio, para el descuento de "leal".
 * @returns {{ committed: object[], hand: object[], impulsoLeft: number, impulsoSpent: number }}
 */
export function commitFromHand(hand, impulso, regenteClass) {
  const sorted = [...hand].sort((a, b) => effectiveDeployCost(b, regenteClass) - effectiveDeployCost(a, regenteClass));
  const committed = [];
  const leftover = [];
  let remaining = impulso;
  for (const card of sorted) {
    const cost = effectiveDeployCost(card, regenteClass);
    if (cost <= remaining) {
      committed.push(card);
      remaining -= cost;
    } else {
      leftover.push(card);
    }
  }
  return { committed, hand: leftover, impulsoLeft: remaining, impulsoSpent: impulso - remaining };
}
