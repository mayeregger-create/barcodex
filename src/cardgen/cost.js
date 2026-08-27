// src/cardgen/cost.js
// Valor y Coste (doc §10). El offset de 8 es necesario: sin el, el V minimo real (~9.1) mapea a
// coste 3 y los niveles 1-2 nunca se usan — la ronda 1 quedaria vacia (Impulso arranca en 2).
import { round, clamp } from "./utils.js";

export function computeValue({ fuerza, integridadTotal, placasEfectivas, iniciativa, cmRasgo, cmLinaje }) {
  return fuerza * 1.0 + integridadTotal * 0.4 + placasEfectivas * 1.2 + iniciativa * 0.2 + cmRasgo + cmLinaje;
}

export function computeCost(value) {
  return clamp(round((value - 8) / 2.4), 1, 8);
}
