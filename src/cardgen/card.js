// src/cardgen/card.js
// Orquestador del pipeline completo (doc §4): 19 pasos, 13 llamadas al PRNG en orden fijo (§3.3).
// generateCard(codigo) -> Card, siempre la misma para el mismo codigo, en cualquier maquina.
import { seededRng, fnv1a } from "../titiritero/prng.js";
import { normalizeCode, isPalindrome } from "./utils.js";
import { lineageFromCode, LINEAGE_BASE_TRAIT } from "./linaje.js";
import { plateBudgetFromCode, pesoFromBudget, capInitiativeByWeight, clampPlateBudget } from "./plates.js";
import { classFromRoll, damageTypesFromRoll, fuerzaFromRoll, iniciativaFromRoll, DAMAGE_TYPES } from "./classGen.js";
import { ZONES, integrityPerZone, distributePlates, materialFromRoll } from "./zones.js";
import { tierFromRoll, selectTrait, selectAnomaloSecondTrait } from "./traits/select.js";
import { nameFromRoll, displayName } from "./names.js";
import { computeValue, computeCost } from "./cost.js";
import { computeRarityScore, rarityFromScore } from "./rarity.js";

export const ENGINE_VERSION = "1.0";

/** Aplica los efectos de rasgos que tocan numeros de generacion, en el orden del doc §8.7. Los
 * rasgos que son puramente de combate (contraataques, dobles acciones, etc.) NO viven aca — se
 * guardan como dato en la carta (id + effect) para que el motor de combate, cuando exista, los
 * lea. Muta y devuelve un `state` nuevo (nunca el original). */
function applyTraitEffects(state, traitIds, clase) {
  const s = { ...state, platedZones: new Set(state.platedZones), integrity: { ...state.integrity } };
  const has = (id) => traitIds.has(id);

  // 1. Presupuesto de placas -> recalcular reparto.
  let budgetDelta = 0;
  if (has("blindado")) budgetDelta += 1;
  if (has("fortificado")) budgetDelta += 2;
  if (has("escurridizo")) budgetDelta -= 1;
  if (budgetDelta !== 0) {
    s.plateBudget = clampPlateBudget(s.plateBudget + budgetDelta);
    const redistributed = distributePlates(clase, s.plateBudget);
    s.platedZones = redistributed.platedZones;
    s.fuerzaBonus2 = redistributed.fuerzaBonus; // rogue/ranger: sobrante otra vez a Fuerza
  }

  // 2. Integridad. `fortificado` sobrescribe TODAS las zonas a 1 (doc: "Todas las zonas a 1 de
  // Integridad") — se aplica al final del paso para que gane sobre los aditivos anteriores.
  if (has("coronado")) s.integrity.head += 2;
  if (has("fibroso")) {
    s.integrity.armMain += 1;
    s.integrity.armOff += 1;
    s.integrity.legs += 1;
  }
  if (has("baluarte")) s.integrity.torso += 3;
  if (has("fortificado")) for (const z of ZONES) s.integrity[z] = 1;

  // 3. Fuerza.
  if (has("colosal")) s.fuerza += 3;
  if (has("vengativo")) s.fuerza -= 1; // contrapartida: "empieza con -1 Fuerza"
  if (has("sereno")) s.fuerza -= 1;
  if (has("senorial")) {
    s.fuerza += 1;
    s.iniciativa += 1;
  }
  if (s.fuerzaBonus2) s.fuerza += s.fuerzaBonus2;

  // 4. Peso -> reaplicar tope de Iniciativa.
  if (has("templado")) s.peso += 1;
  s.iniciativa = capInitiativeByWeight(s.iniciativa, s.peso);

  // 5. Posicion (metadata para el tablero, no numeros de la ficha).
  if (has("avanzado")) s.positionLock = 1;
  if (has("atalaya")) s.positionLock = 3;
  if (has("baluarte")) s.immobile = true;

  return s;
}

export function generateCard(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) throw new Error(`generateCard: codigo invalido "${rawCode}" (debe ser 12 o 13 digitos)`);

  const rng = seededRng(code); // FNV-1a(code) -> mulberry32, 13 llamadas consecutivas en orden fijo
  const palindrome = isPalindrome(code);

  // --- sin PRNG (legibles a partir del propio codigo) ---
  const linaje = lineageFromCode(code);
  const plateBudgetInicial = plateBudgetFromCode(code);

  // --- canales 1-4 ---
  const clase = classFromRoll(rng());
  const { active, secondary } = damageTypesFromRoll(clase, rng());
  let fuerza = fuerzaFromRoll(clase, rng());
  let iniciativa = iniciativaFromRoll(clase, rng());

  // --- canal 5 (x5) ---
  const zoneRolls = [rng(), rng(), rng(), rng(), rng()];
  const integrity = integrityPerZone(clase, zoneRolls);

  // --- reparto de placas (sin PRNG) ---
  const { platedZones, fuerzaBonus } = distributePlates(clase, plateBudgetInicial);
  fuerza += fuerzaBonus;

  // --- canal 6 ---
  const material = materialFromRoll(rng());

  // --- peso (derivado, sin PRNG) ---
  let peso = pesoFromBudget(plateBudgetInicial);
  iniciativa = capInitiativeByWeight(iniciativa, peso);

  // --- canales 7-8 ---
  const traitTier = tierFromRoll(rng());
  const primaryTrait = selectTrait({ tier: traitTier, clase, activeType: active, linaje, isPalindrome: palindrome, roll: rng() });

  const traitIds = new Set([primaryTrait.id]);
  let secondTrait = null;
  if (primaryTrait.id === "anomalo") {
    secondTrait = selectAnomaloSecondTrait(code, primaryTrait, { clase, activeType: active, linaje, isPalindrome: palindrome });
    if (secondTrait) traitIds.add(secondTrait.id);
  }

  let state = { plateBudget: plateBudgetInicial, platedZones, integrity, fuerza, iniciativa, peso };
  state = applyTraitEffects(state, traitIds, clase);

  // --- canal 9 ---
  const { name, gender } = nameFromRoll(linaje, rng());
  const epitetoText = primaryTrait.epiteto[gender];
  const identityDisplayName = displayName(name, clase, epitetoText);

  // --- calculado ---
  const integridadTotal = ZONES.reduce((sum, z) => sum + state.integrity[z], 0);
  const placasEfectivas = state.platedZones.size * material.resistance;
  const cmRasgo = primaryTrait.cm + (secondTrait ? secondTrait.cm : 0);
  const cmLinaje = LINEAGE_BASE_TRAIT[linaje].cm;
  const value = computeValue({ fuerza: state.fuerza, integridadTotal, placasEfectivas, iniciativa: state.iniciativa, cmRasgo, cmLinaje });
  const cost = computeCost(value);

  const rarityScore = computeRarityScore({
    traitTier, linaje, plateBudget: state.plateBudget, materialId: material.id,
    fuerza: state.fuerza, iniciativa: state.iniciativa, code,
  });
  const rarity = rarityFromScore(rarityScore);

  const zones = {};
  for (const z of ZONES) {
    const plated = state.platedZones.has(z);
    zones[z] = { integrity: state.integrity[z], plate: plated ? 1 : 0, plateResist: plated ? material.resistance : 0 };
  }

  const typeInfo = DAMAGE_TYPES[active];

  return {
    code,
    cardId: `BCX-${code}`,
    identity: {
      name,
      gender,
      class: clase,
      trait: primaryTrait.id,
      secondTrait: secondTrait ? secondTrait.id : null,
      displayName: identityDisplayName,
    },
    lineage: linaje,
    rarity,
    cost,
    combat: {
      damageTypeActive: active,
      damageTypeSecondary: secondary,
      strength: state.fuerza,
      initiative: state.iniciativa,
      weight: state.peso,
      station: typeInfo.station,
      reach: typeInfo.reach,
      reachCore: typeInfo.reachCore,
      positionLock: state.positionLock || null,
      immobile: !!state.immobile,
    },
    zones,
    generation: {
      seed: fnv1aSeedFor(code),
      plateBudget: state.plateBudget,
      plateMaterial: material.id,
      traitTier,
      value: Math.round(value * 10) / 10,
      rarityScore,
      engineVersion: ENGINE_VERSION,
    },
  };
}

// Expuesto solo para que `generation.seed` refleje el mismo valor que sembro al PRNG (uso
// informativo/debug — el generador en si nunca vuelve a llamar a esto).
function fnv1aSeedFor(code) {
  return fnv1a(code);
}
