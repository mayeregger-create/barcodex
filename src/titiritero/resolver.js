// src/titiritero/resolver.js
// (card, catalog, slotRegistry) -> Map<slotId, pieceId>. No toca imagenes (doc §5.1). Determinista:
// misma card.id, mismo resultado siempre — ver prng.js, nunca Math.random() aca.
import { seededRng } from "./prng.js";

// 5 tiers (doc Generador de Cartas §11) — mismo vocabulario que usa cardgen/rarity.js. El flujo
// viejo (personajes de character.js, 4 tiers en espanol con mayuscula) se adapta a esto en el
// borde (ver cardFromCharacter en index.js), Titiritero por dentro solo conoce este vocabulario.
export const RARITY_ORDER = ["comun", "poco_comun", "rara", "epica", "legendaria"];

function rarityAtLeast(cardRareza, minRareza) {
  const cardIdx = RARITY_ORDER.indexOf(cardRareza);
  const minIdx = RARITY_ORDER.indexOf(minRareza);
  if (cardIdx === -1 || minIdx === -1) return true; // rareza desconocida: no bloquea
  return cardIdx >= minIdx;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesGlob(pattern, id) {
  if (!pattern.includes("*")) return pattern === id;
  const re = new RegExp("^" + pattern.split("*").map(escapeRegExp).join(".*") + "$");
  return re.test(id);
}

function isExcluded(piece, chosen) {
  // la pieza candidata excluye a alguna ya elegida, o alguna ya elegida la excluye a ella.
  if ((piece.excludes || []).some((pat) => chosen.some((c) => matchesGlob(pat, c.id)))) return true;
  if (chosen.some((c) => (c.excludes || []).some((pat) => matchesGlob(pat, piece.id)))) return true;
  return false;
}

/**
 * Resuelve que pieza va en cada slot para una carta dada.
 * @param {object} card - { id, rareza, clase, continente, sexo, overrides? }
 * @param {object[]} catalog - piezas disponibles (Piece[])
 * @param {object[]} slotRegistry - SLOT_REGISTRY (o un subconjunto)
 * @returns {{ pieceMap: Map<string,string>, warnings: string[] }}
 */
export function resolveCard(card, catalog, slotRegistry) {
  const rng = seededRng(card.id);
  const pieceMap = new Map();
  const warnings = [];
  const chosen = [];

  // 1. overrides fijos primero (saltan la seleccion automatica).
  for (const [slotId, pieceId] of Object.entries(card.overrides || {})) {
    const piece = catalog.find((p) => p.id === pieceId && p.slot === slotId);
    if (piece) {
      pieceMap.set(slotId, piece.id);
      chosen.push(piece);
    } else {
      warnings.push(`override invalido: ${slotId} -> ${pieceId} (no existe en el catalogo)`);
    }
  }

  // 2. slots restantes con hueso (rivets/frame los maneja el Framer, no el resolver de cuerpo).
  const bodySlots = slotRegistry.filter((s) => s.bone && !pieceMap.has(s.id));

  for (const slotDef of bodySlots) {
    const candidates = catalog.filter(
      (p) => p.slot === slotDef.id && rarityAtLeast(card.rareza, p.rarityMin || "comun") && !isExcluded(p, chosen)
    );

    if (candidates.length === 0) {
      if (slotDef.required) {
        const fallback = catalog.find((p) => p.slot === slotDef.id && p.id.endsWith("_default"));
        if (fallback) {
          pieceMap.set(slotDef.id, fallback.id);
          chosen.push(fallback);
          warnings.push(`slot obligatorio "${slotDef.id}" sin candidatos validos, uso default "${fallback.id}"`);
        } else {
          warnings.push(`slot obligatorio "${slotDef.id}" SIN pieza disponible (ni siquiera default)`);
        }
      }
      continue;
    }

    const picked = candidates[Math.floor(rng() * candidates.length)];
    pieceMap.set(slotDef.id, picked.id);
    chosen.push(picked);
  }

  return { pieceMap, warnings };
}
