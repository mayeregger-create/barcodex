// src/core/squad.js
// Rueda elemental estilo MTG (seccion 6) + deteccion de tipo de escuadron (seccion 7).

import { CONTINENT_ORDER } from "../data/continents.js";
import { RAREZA_BONUS } from "../data/abilities.js";

/** Relacion entre dos continentes: "mismo" | "afin" | "rival" */
export function relation(contA, contB) {
  const a = CONTINENT_ORDER.indexOf(contA);
  const b = CONTINENT_ORDER.indexOf(contB);
  if (a === b) return "mismo";
  const d = Math.min((a - b + 5) % 5, (b - a + 5) % 5);
  return d === 1 ? "afin" : "rival";
}

/** Modificador de daño + info de la relacion, para el matchup 1v1 dentro del combate. */
export function wheelModifier(contA, contB) {
  const rel = relation(contA, contB);
  if (rel === "afin") return { rel, dmgMod: 0.85, label: "Afines: -15% daño, +1 Energia/turno" };
  if (rel === "rival") return { rel, dmgMod: 1.25, label: "Rivales: +25% daño mutuo" };
  return { rel, dmgMod: 1.0, label: "Mismo continente: neutro" };
}

/**
 * Calcula el tipo de escuadron y los buffs por miembro.
 * @param {string[]} continents - 3 continentes en el orden elegido (principal primero).
 */
export function analyzeSquad(continents) {
  const [a, b, c] = continents;
  const r1 = relation(a, b); // principal-miembro2
  const r2 = relation(a, c); // principal-miembro3
  const r3 = relation(b, c); // miembro2-miembro3

  let tipo;
  if (r1 === "mismo" && r2 === "mismo") tipo = "Monobloque";
  else if (r1 === "mismo" || r2 === "mismo") {
    const other = r1 === "mismo" ? r2 : r1;
    tipo = other === "afin" ? "Nucleo (bateria)" : "Nucleo (presion)";
  } else if (r1 === "afin" && r2 === "afin") tipo = "Bastion";
  else if (r1 === "rival" && r2 === "rival") tipo = "Vanguardia";
  else tipo = "Mixto";

  const pairs = [[0, 1, r1], [0, 2, r2], [1, 2, r3]];
  const buffs = [
    { energia: 0, critico: 0, defensa: 0, resistencia: 0 },
    { energia: 0, critico: 0, defensa: 0, resistencia: 0 },
    { energia: 0, critico: 0, defensa: 0, resistencia: 0 },
  ];
  for (const [i, j, rel] of pairs) {
    if (rel === "afin") { buffs[i].energia += 1; buffs[j].energia += 1; }
    else if (rel === "rival") {
      buffs[i].critico += 15; buffs[i].defensa -= 10;
      buffs[j].critico += 15; buffs[j].defensa -= 10;
    } else {
      buffs[i].resistencia += 10; buffs[j].resistencia += 10;
    }
  }
  return { tipo, buffs, pairRelations: { principal_miembro2: r1, principal_miembro3: r2, miembro2_miembro3: r3 } };
}

/**
 * Amplifica los buffs de cada miembro segun su propia rareza: mas bonus donde ya tiene bonus,
 * menos penalizacion donde ya tiene penalizacion. No inventa categorias nuevas — la ventaja del
 * mas raro solo se nota en el contexto del equipo, nunca en su ficha individual.
 * @param {object[]} buffs - buffs devueltos por analyzeSquad.
 * @param {object[]} team - los 3 personajes en el mismo orden, cada uno con su .rareza.
 */
export function applyRarezaToBuffs(buffs, team) {
  return buffs.map((buff, i) => {
    const bonus = RAREZA_BONUS[team[i].rareza] ?? 0;
    if (bonus === 0) return buff;
    return {
      energia: buff.energia > 0 ? buff.energia + bonus : buff.energia,
      critico: buff.critico > 0 ? buff.critico + bonus : buff.critico,
      defensa: buff.defensa < 0 ? Math.min(0, buff.defensa + bonus) : buff.defensa,
      resistencia: buff.resistencia > 0 ? buff.resistencia + bonus : buff.resistencia,
    };
  });
}
