// src/cardgen/linaje.js
// Prefijo GS1 (digitos 1-3) + digito 4 como desempate -> Linaje. Sin PRNG (doc §5): legible, un
// jugador puede predecirlo mirando el codigo — ahi vive el descubrimiento comunitario.
// Tabla PROVISORIA (doc §5, verificada sobre 10.000 codigos con pesos realistas, pero marcada
// para recalibrar cuando exista una muestra real de escaneos de usuarios).
export const LINEAGES = ["prensa", "fundicion", "cantera", "marea", "injerto"];

const FUNDICION_EXTRA = new Set([450, 451, 452, 453, 454, 455, 456, 457, 458, 459, 471, 489, 880, 885, 893]);
function inFundicionExtraRange(p) {
  return (p >= 490 && p <= 499) || FUNDICION_EXTRA.has(p);
}

export function lineageFromCode(code) {
  const p = Number(code.slice(0, 3));
  const d4 = Number(code[3]);

  if ((p >= 930 && p <= 949) || p === 955) return "marea";
  if (p >= 690 && p <= 699) return d4 <= 4 ? "fundicion" : "cantera";
  if (p <= 139) return d4 <= 5 ? "injerto" : "cantera";
  if (p >= 600 && p <= 629) return "cantera";
  if (p >= 740 && p <= 790) return "injerto";
  if (inFundicionExtraRange(p)) return "fundicion";
  if (p >= 800 && p <= 849) return d4 <= 4 ? "prensa" : "injerto";
  return "prensa";
}

// Rasgo base por linaje (doc §5.1) — efecto de combate (no lo ejecuta el generador, es dato de la
// carta) + su Modificador de Coste (CM), que SI entra en la formula de Coste (cost.js).
export const LINEAGE_BASE_TRAIT = {
  prensa: { id: "laminado", effect: "Placas +1 resistencia. Peso +1", cm: 0.5 },
  fundicion: { id: "templado_linaje", effect: "+2 Iniciativa. Integridad de torso -1", cm: 0.5 },
  cantera: { id: "macizo", effect: "Una vez por partida, la primera zona que llegaria a 0 queda en 1", cm: 0.5 },
  marea: { id: "fluvial", effect: "Una vez por ronda, mover no consume la accion", cm: 1.5 },
  injerto: { id: "voraz", effect: "Al colapsar un enemigo adyacente, recupera 1 de Integridad en una zona danada", cm: 0.5 },
};
