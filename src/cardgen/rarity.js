// src/cardgen/rarity.js
// La rareza no se asigna: se calcula (doc §11) — describe que tan improbable fue la combinacion.
import { hasConsecutiveRepeats, uniqueDigitCount, isPalindrome } from "./utils.js";

export function computeRarityScore({ traitTier, linaje, plateBudget, materialId, fuerza, iniciativa, code }) {
  let score = 0;
  if (traitTier === "raro") score += 3;
  else if (traitTier === "legendario") score += 7;

  if (linaje === "marea") score += 1;
  if (plateBudget === 0 || plateBudget === 4) score += 1;
  if (materialId === "acero_runico") score += 2;
  if (fuerza >= 6 || fuerza <= 2) score += 1;
  if (iniciativa >= 9 || iniciativa <= 2) score += 1;
  if (hasConsecutiveRepeats(code)) score += 1;
  if (uniqueDigitCount(code) <= 4) score += 2;
  if (isPalindrome(code)) score += 3;

  return score;
}

export function rarityFromScore(score) {
  if (score <= 1) return "comun";
  if (score <= 4) return "poco_comun";
  if (score <= 7) return "rara";
  if (score <= 10) return "epica";
  return "legendaria";
}

export const RARITY_MATERIAL = {
  comun: { rivet: "Latón mate", frame: "Filete simple", finish: "Papel plano" },
  poco_comun: { rivet: "Acero", frame: "Filete doble", finish: "Leve realce" },
  rara: { rivet: "Plata", frame: "Trabajado, laterales ornamentados", finish: "Barniz selectivo" },
  epica: { rivet: "Oro", frame: "Completo, con gema engastada", finish: "Relieve, brillo" },
  legendaria: { rivet: "Oro grabado", frame: "Desborda el marco", finish: "Foil, partículas" },
};
