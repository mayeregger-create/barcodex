// src/cardgen/plates.js
// Presupuesto de placas (suma de los 13 digitos, sin PRNG) + Peso derivado. Doc §6/§6.1 — los
// umbrales de abajo son los RECALIBRADOS (la formula original redondear(suma/30) daba 81% en
// presupuesto 2 y nunca 0 o 4, porque la suma de digitos de un codigo real es una campana angosta
// centrada en 56, desvio 11 — no una uniforme).
import { digitSum, clamp } from "./utils.js";

export function plateBudgetFromCode(code) {
  const sum = digitSum(code);
  if (sum < 42) return 0;
  if (sum < 50) return 1;
  if (sum < 62) return 2;
  if (sum < 70) return 3;
  return 4;
}

/** Peso no es una tirada: es la consecuencia visible de cuanta armadura carga la unidad (doc §6.1). */
export function pesoFromBudget(plateBudget) {
  return plateBudget + 1; // rango 1-5
}

/** Tope por Peso (doc §6.1): Peso 5 no puede superar Iniciativa 6. Se reaplica despues de
 * modificadores de rasgo que toquen Peso (ver §8.7 paso 4, traits.js). */
export function capInitiativeByWeight(initiative, peso) {
  return peso >= 5 ? Math.min(initiative, 6) : initiative;
}

export function clampPlateBudget(n) {
  return clamp(n, 0, 4);
}
