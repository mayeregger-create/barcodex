// src/core/character.js
// Motor de generacion de personajes a partir de un codigo EAN-13.
// Ver diseño_juego_codigo_barras.md secciones 2, 2.2, 2.3, 3, 4, 5.

import { getContinent, CONTINENT_TRAITS } from "../data/continents.js";
import { ABILITIES, CLASSES, STAT_ORDER, CLASS_ROLES, ABILITY_ADJECTIVES, RAREZA_BONUS } from "../data/abilities.js";
import { NAMES } from "../data/names.js";

export function checkDigit(d12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const w = i % 2 === 0 ? 1 : 3;
    sum += Number(d12[i]) * w;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEAN13(code13) {
  if (!/^\d{13}$/.test(code13)) return false;
  return checkDigit(code13.slice(0, 12)) === Number(code13[12]);
}

/** Codigo EAN-13 valido al azar — para rivales de CPU en pruebas, no para escaneos reales. */
export function randomCode() {
  let d12 = "";
  for (let i = 0; i < 12; i++) d12 += Math.floor(Math.random() * 10);
  return d12 + checkDigit(d12);
}

/** Nombre del personaje: pool por continente x sexo, indexado por digitos del codigo. */
export function generateName(D, sexo, continente) {
  const pool = NAMES[continente][sexo];
  const idx = (D[2] + D[5] + D[8] + D[11]) % pool.length;
  return pool[idx];
}

/**
 * Genera un personaje completo a partir de un codigo EAN-13 valido.
 * @param {string} code13 - 13 digitos, con digito verificador correcto.
 * @returns {object} personaje con stats, clase, continente, sexo, habilidad, rareza.
 */
export function generateCharacter(code13) {
  const D = code13.split("").map(Number);

  // --- Los 5 stats base (los 5 lentes numericos). Las 5 formulas son sumas/combinaciones
  // lineales de digitos, mod 20 + 1 — a proposito, es el patron que ya daba una distribucion
  // pareja en Fuerza/Velocidad. Antes Defensa (productos) y Energia (diferencia de mitades)
  // usaban otra forma matematica "por variedad", pero eso las sesgaba (Defensa en diente de
  // sierra, Energia hacia valores bajos) y Suerte solo podia dar 10/15/20 — entre las tres,
  // Bardo salia el 41% de las veces y Mago el 6% (medido por simulacion, ver chat). ---
  let Fuerza = ((D[0] + D[2] + D[4] + D[6] + D[8] + D[10] + D[12]) % 20) + 1;
  let Velocidad = ((D[1] + D[3] + D[5] + D[7] + D[9] + D[11]) % 20) + 1;
  let Defensa = ((D[0] + D[1] + D[3] + D[4] + D[6] + D[7] + D[9] + D[10]) % 20) + 1;
  const sum1 = D.slice(0, 6).reduce((a, b) => a + b, 0);
  const sum2 = D.slice(6, 12).reduce((a, b) => a + b, 0);
  let Energia = ((sum1 * 2 + sum2) % 20) + 1;

  // Suerte: las repeticiones de digitos (tambien deciden la rareza, ver mas abajo) suman como un
  // empujon, no como el unico factor — asi conserva algo de "codigo con patrones raros = mas
  // suerte" sin volver a quedar pegada a un techo de solo 3 valores posibles.
  let repeats = 0;
  for (let i = 0; i < 12; i++) if (D[i] === D[i + 1]) repeats++;
  let Suerte = (((D[1] + D[4] + D[7] + D[10]) * 3 + repeats * 5) % 20) + 1;

  const base = { Fuerza, Velocidad, Defensa, Energia, Suerte };

  // --- Clase: estadistica dominante, calculada ANTES de bonus de elemento/sexo ---
  let claseStat = STAT_ORDER[0];
  for (const k of STAT_ORDER) if (base[k] > base[claseStat]) claseStat = k;
  const clase = CLASSES[claseStat].name;

  // --- Sexo: SOLO los primeros 12 digitos (sin el verificador). Ver nota tecnica seccion 2.3 ---
  const sexo = D.slice(0, 12).reduce((a, b) => a + b, 0) % 2 === 0 ? "Masculino" : "Femenino";

  // --- Elemento / continente + su trait ---
  const prefix = Number(code13.slice(0, 3));
  const continente = getContinent(prefix);
  const trait = CONTINENT_TRAITS[continente];

  const final = { ...base };
  const traitStatFixed = { Europa: "Energia", Asia: "Defensa", Africa: "Fuerza" };
  if (continente === "America") {
    const hi = STAT_ORDER.reduce((a, b) => (final[b] > final[a] ? b : a));
    final[hi] = Math.min(20, final[hi] + 2);
  } else if (continente === "Oceania") {
    const lo = STAT_ORDER.reduce((a, b) => (final[b] < final[a] ? b : a));
    final[lo] = Math.min(20, final[lo] + 2);
  } else if (traitStatFixed[continente]) {
    const k = traitStatFixed[continente];
    final[k] = Math.min(20, final[k] + 2);
  }

  // --- Bonus de sexo, con prioridad de clase (seccion 2.3) ---
  const pares = { Masculino: ["Fuerza", "Defensa"], Femenino: ["Energia", "Velocidad"] };
  const par = pares[sexo];
  let primaria, secundaria;
  if (par.includes(claseStat)) {
    primaria = claseStat;
    secundaria = par.find((s) => s !== claseStat);
  } else {
    [primaria, secundaria] = par;
  }
  const before = final[primaria];
  final[primaria] = Math.min(20, final[primaria] + 2);
  const overflow = 2 - (final[primaria] - before);
  final[secundaria] = Math.min(20, final[secundaria] + 2 + overflow);

  // --- Rareza (patrones repetidos, sin ventajas por continente). Los umbrales van en el orden
  // real de frecuencia (1 repeticion es mas comun que 0), no en el orden numerico de "repeats".
  let rareza;
  if (repeats >= 3) rareza = "Epico";
  else if (repeats === 2) rareza = "Raro";
  else if (repeats === 1) rareza = "Comun";
  else rareza = "Poco comun";

  // --- Bonus de rareza: empuja un poco mas la estadistica dominante (seccion 2 extendida) ---
  final[claseStat] = Math.min(20, final[claseStat] + RAREZA_BONUS[rareza]);

  // --- Habilidad especial (digito verificador D13) ---
  const habilidad = ABILITIES[D[12]];

  // --- HP total (seccion 8). Recalibrado en playtesting: x2+20 daba ~10-11 acciones/KO (muy
  // lento); x0.75+5 daba ~4 (demasiado corto); x1.5+15 promedia ~8, el punto medio buscado. ---
  const hpMax = Math.round((final.Fuerza + final.Defensa) * 1.5 + 15);

  // --- Nombre (lente nuevo, pool por continente x sexo) ---
  const nombre = generateName(D, sexo, continente);

  // --- Epiteto: rol afin a la clase + adjetivo afin a la habilidad especial ---
  const rolIdx = (D[1] + D[4] + D[7] + D[10]) % CLASS_ROLES[clase].length;
  const rol = CLASS_ROLES[clase][rolIdx];
  const adjIdx = (D[0] + D[3] + D[6] + D[9]) % ABILITY_ADJECTIVES[D[12]].length;
  const epiteto = ABILITY_ADJECTIVES[D[12]][adjIdx];

  return {
    code: code13,
    nombre, rol, epiteto, clase, claseStat, sexo, continente, trait, rareza,
    habilidad, stats: final, hp: hpMax, hpMax,
    parry: CLASSES[claseStat].parry,
  };
}
