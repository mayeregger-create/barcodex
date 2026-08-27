// src/cardgen/classGen.js
// Clase, tipo de dano activo/secundario, Fuerza, Iniciativa. Canales 1-4 (doc §3.3/§7.1-§7.4).
import { round } from "./utils.js";

export const CLASSES = ["warrior", "paladin", "rogue", "ranger", "templar", "sentinel"];

// Estacion/Alcance como el conjunto de posiciones validas (1/2/3); Magic ademas alcanza el Nucleo
// (reachCore) por encima de cualquier posicion (doc §3, §3.1: "cualquiera + Nucleo").
export const DAMAGE_TYPES = {
  pierce: { fuerzaTope: 3, station: [2, 3], reach: [2, 3], reachCore: false },
  cut: { fuerzaTope: 4, station: [1, 2], reach: [1, 2], reachCore: false },
  blunt: { fuerzaTope: 3, station: [1], reach: [1], reachCore: false },
  magic: { fuerzaTope: 2, station: [1, 2, 3], reach: [1, 2, 3], reachCore: true },
};

// Par de tipos por clase, orden fijo (primero = "tipo 1" para el canal 2). Doc §7.2.
export const CLASS_DAMAGE_PAIR = {
  warrior: ["cut", "blunt"],
  paladin: ["blunt", "magic"],
  rogue: ["pierce", "cut"],
  ranger: ["pierce", "magic"],
  templar: ["cut", "magic"],
  sentinel: ["pierce", "blunt"],
};

const FUERZA_BASE = { warrior: 4, sentinel: 4, paladin: 3, rogue: 3, ranger: 3, templar: 3 };
const INICIATIVA_BASE = { rogue: 8, ranger: 7, templar: 5, warrior: 4, sentinel: 4, paladin: 3 };

export function classFromRoll(roll) {
  const idx = Math.min(CLASSES.length - 1, Math.floor(roll * CLASSES.length));
  return CLASSES[idx];
}

/** Devuelve { active, secondary } — el canal 2 elige cual de los 2 tipos de la clase queda activo. */
export function damageTypesFromRoll(clase, roll) {
  const [a, b] = CLASS_DAMAGE_PAIR[clase];
  return roll < 0.5 ? { active: a, secondary: b } : { active: b, secondary: a };
}

export function fuerzaFromRoll(clase, roll) {
  return FUERZA_BASE[clase] + round(roll * 3) - 1; // variacion -1 a +2 (doc §7.3)
}

export function iniciativaFromRoll(clase, roll) {
  return INICIATIVA_BASE[clase] + round(roll * 5) - 2; // variacion -2 a +2 (doc §7.4)
}
