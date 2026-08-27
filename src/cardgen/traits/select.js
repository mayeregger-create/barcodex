// src/cardgen/traits/select.js
// Tier (canal 7) + seleccion dentro del pool filtrado (canal 8). Doc §8.1/§8.2.
import { TRAITS_BY_TIER, TRAITS_BY_ID, ALL_TRAITS } from "./catalog.js";
import { filterPool, areMutuallyExclusive } from "./compatibility.js";
import { fnv1a, mulberry32 } from "../../titiritero/prng.js";

export function tierFromRoll(roll) {
  if (roll < 0.65) return "comun";
  if (roll < 0.95) return "raro";
  return "legendario";
}

/** Orden estable por id — OBLIGATORIO (doc §8.2): si el pool llegara en otro orden entre
 * ejecuciones, las cartas cambiarian. Los arrays de catalog.js ya estan en orden fijo, pero se
 * ordena explicito para no depender de eso silenciosamente. */
function stableSortById(pool) {
  return [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Elige el rasgo de una carta. No hay fallback: el pool se filtra ANTES de sortear, asi que si el
 * pool queda vacio es un agujero real en la matriz de compatibilidad (cubierto por el test de
 * integridad estructural, doc §16.3) — no algo que este codigo deba disimular.
 */
export function selectTrait({ tier, clase, activeType, linaje, isPalindrome, roll }) {
  const pool = stableSortById(filterPool(TRAITS_BY_TIER[tier], { clase, activeType, linaje, isPalindrome }));
  if (pool.length === 0) {
    throw new Error(`selectTrait: pool vacio para tier=${tier} clase=${clase} tipo=${activeType} linaje=${linaje}`);
  }
  const idx = Math.min(pool.length - 1, Math.floor(roll * pool.length));
  return pool[idx];
}

/**
 * `anomalo` otorga un SEGUNDO rasgo — el documento no reserva un canal para esto (los 13 canales
 * terminan en Nombre), asi que inventar un 14° canal correria el orden de todo lo que viene
 * despues y rompe el contrato "13 llamadas por carta". En su lugar, este segundo sorteo usa su
 * PROPIA semilla derivada (hash del codigo + el id de la carta ya conocido), separada del PRNG
 * principal — sigue siendo 100% deterministico, solo que no consume uno de los 13 canales
 * documentados. Marcado junto con `anomalo`/`ancestral` como `requiresPlaytest`.
 */
export function selectAnomaloSecondTrait(code, primary, ctx) {
  const rng = mulberry32(fnv1a(code + "|anomalo_second"));
  const pool = stableSortById(
    filterPool(ALL_TRAITS, ctx).filter((t) => t.id !== "anomalo" && !areMutuallyExclusive(t.id, primary.id))
  );
  if (pool.length === 0) return null;
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[idx];
}

export function traitById(id) {
  return TRAITS_BY_ID.get(id);
}
