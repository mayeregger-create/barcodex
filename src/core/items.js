// src/core/items.js
// Sistema de items desde ISBN, 6 categorias. Ver diseño_juego_codigo_barras.md seccion 2.1.

import { checkDigit } from "./character.js";
import { STAT_ORDER } from "../data/abilities.js";

const WEAPON_BY_STAT = {
  Fuerza: "Espada (afin Guerrero)",
  Velocidad: "Daga (afin Picaro)",
  Defensa: "Escudo (afin Tanque)",
  Energia: "Baston (afin Mago)",
  Suerte: "Cartas (afin Bardo)",
};
const WEAPON_BASE_NAME = { Fuerza: "Espada", Velocidad: "Daga", Defensa: "Escudo", Energia: "Bastón", Suerte: "Cartas" };
const WEAPON_CLASS = { Fuerza: "Guerrero", Velocidad: "Picaro", Defensa: "Tanque", Energia: "Mago", Suerte: "Bardo" };

export const LIBROS = [
  "Al conectar un critico, todo el escuadron gana +1 Energia",
  "Al bloquear con Parry exitosamente, 20% de aturdir al rival 1 turno",
  "Al entrar por reemplazo automatico, cura 10% de HP maximo al entrar",
  "Cada 3 turnos, el activo regenera 1 Energia extra",
  "Al usar habilidad especial, 15% de no gastar Energia",
  "Al recibir un critico enemigo, 25% de que se resuelva como golpe normal",
  "Al ganar ventaja de rivalidad elemental, +5% de critico ese turno",
  "El primer critico fallido del combate (de cualquiera) se vuelve a tirar una vez",
];

export const ACCESORIOS = [
  "50% de resistir paralisis/stun",
  "40% de que un critico enemigo se resuelva como golpe normal",
  "La penalizacion de rival elemental se reduce a la mitad",
  "50% de resistir 'pierde el turno'",
  "Drenaje enemigo rinde la mitad contra este personaje",
  "Inmune al primer debuff del combate (una vez por combate)",
];
// Nombre base por efecto de accesorio (mismo indice que ACCESORIOS).
const ACCESORIO_BASE_NAME = ["Anillo", "Talismán", "Medallón", "Brazalete", "Sello", "Amuleto"];

export const RELIQUIAS = [
  { alcance: "1 personaje", efecto: "20% de que una habilidad enemiga tambien afecte a quien la lanzo" },
  { alcance: "1 personaje, 1 uso", efecto: "Actua una vez mas antes del turno rival" },
  { alcance: "Escuadron", efecto: "El que entra por reemplazo hereda 25% de la Energia del caido" },
  { alcance: "1 personaje", efecto: "El combate se resuelve siempre como mismo continente (neutro)" },
  { alcance: "1 personaje, 1 uso", efecto: "Cura HP = 2x Energia actual, pone Energia en 0" },
  { alcance: "Escuadron, 1x por combate", efecto: "El primer critico fallido del combate se vuelve a tirar" },
];
// Nombre base por reliquia (mismo indice que RELIQUIAS): espejo, reloj de arena, semilla de intercambio, brujula, vela, dado.
const RELIC_BASE_NAME = ["Espejo", "Reloj de arena", "Semilla de intercambio", "Brújula", "Vela", "Dado"];

// Materiales posibles del objeto — lente independiente, da variedad sin tocar el balance.
const MATERIALS = ["Piedra", "Acero", "Hielo", "Madera", "Cristal", "Hueso", "Bronce", "Obsidiana", "Plata", "Oro"];

// Condicion del objeto: da nombre + multiplicador real sobre la magnitud (solo items con magnitud numerica).
// El peso baja a medida que la condicion mejora, asi que cuanto mas fuerte, mas dificil de conseguir.
const CONDITIONS = [
  { name: "Rota", mult: -0.20, weight: 30 },
  { name: "Usada", mult: -0.10, weight: 25 },
  { name: "Nueva", mult: 0, weight: 20 },
  { name: "Impecable", mult: 0.10, weight: 15 },
  { name: "Perfecta", mult: 0.20, weight: 7 },
  { name: "Celestial", mult: 0.35, weight: 3 },
]; // pesos suman 100

function pickMaterial(D) {
  return MATERIALS[D.slice(0, 4).reduce((a, b) => a + b, 0) % MATERIALS.length];
}

/** Tirada ponderada (0-99) sobre los 13 digitos, para que las condiciones raras salgan menos seguido. */
function pickCondition(D) {
  const roll = D.reduce((acc, d, i) => acc + d * (i + 1), 0) % 100;
  let cumulative = 0;
  for (const condition of CONDITIONS) {
    cumulative += condition.weight;
    if (roll < cumulative) return condition;
  }
  return CONDITIONS[CONDITIONS.length - 1];
}

/** Escala una magnitud base por el multiplicador de condicion, redondeado, nunca menos de 1. */
function scaleMagnitude(base, mult) {
  return Math.max(1, Math.round(base * (1 + mult)));
}

/** Codigo ISBN valido al azar (978/979) — para generar datos de prueba, no para escaneos reales. */
export function randomItemCode() {
  const prefix = Math.random() < 0.5 ? "978" : "979";
  let rest = "";
  for (let i = 0; i < 9; i++) rest += Math.floor(Math.random() * 10);
  const d12 = prefix + rest;
  return d12 + checkDigit(d12);
}

export function isValidISBN13(code13) {
  if (!/^\d{13}$/.test(code13)) return false;
  if (!(code13.startsWith("978") || code13.startsWith("979"))) return false;
  return checkDigit(code13.slice(0, 12)) === Number(code13[12]);
}

/**
 * Genera un item a partir de un ISBN de 13 digitos valido.
 * Regla de balance: magnitudes en rango 1-5 (mod 5 + 1), nunca 1-10, antes de aplicar la condicion.
 */
export function generateItem(code13) {
  const D = code13.split("").map(Number);

  let repeats = 0;
  for (let i = 0; i < 12; i++) if (D[i] === D[i + 1]) repeats++;
  // Misma escala de rareza que los personajes (seccion 2), sobre el mismo conteo de repeticiones.
  // 1 repeticion es mas frecuente que 0, por eso "Comun" va en 1 y "Poco comun" en 0.
  const rareza = repeats >= 3 ? "Epico" : repeats === 2 ? "Raro" : repeats === 1 ? "Comun" : "Poco comun";

  const material = pickMaterial(D);
  const condition = pickCondition(D);
  const condicion = condition.name;

  if (repeats >= 3) {
    const idx = D[12] % 6;
    return {
      code: code13, categoria: "Reliquia", rareza, material, condicion,
      baseName: RELIC_BASE_NAME[idx], ...RELIQUIAS[idx],
    };
  }

  const catIdx = D.slice(3, 9).reduce((a, b) => a + b, 0) % 5;
  const categorias = ["Elixir", "Arma", "Libro", "Armadura/Casco", "Accesorio"];
  const categoria = categorias[catIdx];
  const magnitudBase = (D.slice(10, 12).reduce((a, b) => a + b, 0) % 5) + 1;
  const magnitud = scaleMagnitude(magnitudBase, condition.mult);
  const stat = STAT_ORDER[D[12] % 5];

  switch (categoria) {
    case "Elixir": {
      const duracion = (D[9] % 3) + 1;
      return { code: code13, categoria, rareza, material, condicion, stat, magnitud, duracion, alcance: "1 personaje, temporal" };
    }
    case "Arma": {
      const magnitudAfin = magnitud + 2;
      return {
        code: code13, categoria, rareza, material, condicion,
        arma: WEAPON_BY_STAT[stat], baseName: WEAPON_BASE_NAME[stat], claseAfin: WEAPON_CLASS[stat],
        stat, magnitud, magnitudAfin, alcance: "1 personaje, permanente",
      };
    }
    case "Libro": {
      const idx = D[12] % 8;
      return { code: code13, categoria, rareza, material, condicion, efecto: LIBROS[idx], alcance: "Escuadron completo" };
    }
    case "Armadura/Casco": {
      const subtipo = D[8] % 2 === 1 ? "Casco" : "Armadura";
      return { code: code13, categoria, rareza, material, condicion, subtipo, stat: "Defensa", magnitud, alcance: "1 personaje, permanente" };
    }
    case "Accesorio": {
      const idx = D[12] % 6;
      return {
        code: code13, categoria, rareza, material, condicion,
        baseName: ACCESORIO_BASE_NAME[idx], efecto: ACCESORIOS[idx], alcance: "1 personaje, permanente",
      };
    }
    default:
      return null;
  }
}

/** Palabra base del tipo de objeto (sin material/condicion), para armar el nombre. */
function itemBaseName(item) {
  switch (item.categoria) {
    case "Reliquia": return item.baseName;
    case "Elixir": return "Elixir";
    case "Arma": return item.baseName;
    case "Libro": return "Libro";
    case "Armadura/Casco": return item.subtipo;
    case "Accesorio": return item.baseName;
    default: return "Ítem";
  }
}

/** Nombre completo evocativo: Tipo + de Material + Condicion. Ej: "Brújula de Cristal Rota". */
export function itemLabel(item) {
  return `${itemBaseName(item)} de ${item.material} ${item.condicion}`;
}

/** Descripcion del efecto (numerico o de texto segun categoria), para mostrar debajo del nombre. */
export function itemEffectDescription(item) {
  switch (item.categoria) {
    case "Elixir":
      return `+${item.magnitud} ${item.stat} durante ${item.duracion} turno(s)`;
    case "Arma":
      return `+${item.magnitud} ${item.stat} ( +${item.magnitudAfin} si la clase es ${item.claseAfin} )`;
    case "Armadura/Casco":
      return `+${item.magnitud} ${item.stat}`;
    case "Libro":
    case "Accesorio":
    case "Reliquia":
      return item.efecto;
    default:
      return "";
  }
}

/** Aplica el bonus de un item numerico (Elixir/Arma/Armadura) a un objeto de stats, respetando el tope 20. */
export function applyItemToStats(stats, item, isAffinClass = false) {
  const next = { ...stats };
  if (item.categoria === "Elixir" || item.categoria === "Armadura/Casco") {
    next[item.stat] = Math.min(20, next[item.stat] + item.magnitud);
  } else if (item.categoria === "Arma") {
    const mag = isAffinClass ? item.magnitudAfin : item.magnitud;
    next[item.stat] = Math.min(20, next[item.stat] + mag);
  }
  return next;
}
