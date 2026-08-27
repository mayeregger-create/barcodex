// src/cardgen/zones.js
// Integridad por zona (canal 5, x5), reparto de placas (sin PRNG, orden fijo por clase),
// material de placa (canal 6). Doc §7.5-§7.7.
import { round } from "./utils.js";

export const ZONES = ["head", "torso", "armMain", "armOff", "legs"];

const ZONE_BASE = { head: 2, torso: 4, armMain: 3, armOff: 2, legs: 3 };

// Unico modificador de clase de la tabla §7.5: Torso. El resto queda en 0.
const TORSO_CLASS_MOD = { warrior: 1, paladin: 1, rogue: -1, ranger: -1, templar: 0, sentinel: 0 };

/** rolls: array de 5 numeros [0,1), en el orden del canal 5 (cabeza, torso, brazoPr, brazoSec, piernas). */
export function integrityPerZone(clase, rolls) {
  const out = {};
  ZONES.forEach((zone, i) => {
    const classMod = zone === "torso" ? TORSO_CLASS_MOD[clase] : 0;
    const value = ZONE_BASE[zone] + classMod + round(rolls[i] * 3) - 1;
    out[zone] = Math.max(1, value);
  });
  return out;
}

// Orden fijo de blindaje por clase (doc §7.6) + tope de zonas blindables.
const PLATE_ORDER = {
  paladin: { order: ["torso", "armOff", "head", "armMain", "legs"], cap: 5 },
  warrior: { order: ["torso", "armMain", "head", "legs", "armOff"], cap: 5 },
  sentinel: { order: ["torso", "legs", "armMain", "head", "armOff"], cap: 5 },
  templar: { order: ["torso", "head", "armMain", "armOff", "legs"], cap: 5 },
  rogue: { order: ["torso", "head"], cap: 2 },
  ranger: { order: ["head", "torso"], cap: 2 },
};

/**
 * Vuelca el presupuesto en el orden fijo de la clase hasta agotarse o llegar al tope de zonas.
 * Rogue/Ranger convierten presupuesto sobrante (por el tope de 2 zonas) en +1 Fuerza por punto no
 * gastado, hasta +2 (doc §7.6) — devuelto como `fuerzaBonus` para que classGen aplique el ajuste.
 * @returns {{ platedZones: Set<string>, fuerzaBonus: number }}
 */
export function distributePlates(clase, plateBudget) {
  const { order, cap } = PLATE_ORDER[clase];
  const platedCount = Math.min(plateBudget, cap, order.length);
  const platedZones = new Set(order.slice(0, platedCount));
  const leftover = Math.max(0, plateBudget - platedCount);
  const fuerzaBonus = cap < 5 ? Math.min(leftover, 2) : 0;
  return { platedZones, fuerzaBonus };
}

const MATERIALS = [
  { id: "cuero", resistance: 1, blocksMagic: false, max: 0.35 },
  { id: "hierro", resistance: 1, blocksMagic: false, max: 0.7 },
  { id: "acero", resistance: 2, blocksMagic: false, max: 0.95 },
  { id: "acero_runico", resistance: 2, blocksMagic: true, max: 1.01 },
];

export function materialFromRoll(roll) {
  for (const m of MATERIALS) if (roll < m.max) return m;
  return MATERIALS[MATERIALS.length - 1];
}
