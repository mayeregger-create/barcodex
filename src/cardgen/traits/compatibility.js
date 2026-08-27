// src/cardgen/traits/compatibility.js
// Matriz de compatibilidad (doc §8.3), precalculada como sets/lookups en vez de resolverse en
// tiempo de generacion. El pool se filtra ANTES de sortear (§8.2) — nunca hay fallback, porque un
// fallback alfabetico distorsiona la distribucion de rasgos sin razon de diseno.
import { CLASS_DAMAGE_PAIR } from "../classGen.js";

// Por tipo de dano activo: colisiones de estacion/posicion con rasgos que fijan la posicion.
const STATION_EXCLUDES = {
  blunt: new Set(["atalaya"]), // estacion 1 -> Atalaya (solo posicion 3) queda inservible
  cut: new Set(["atalaya"]), // estacion 1-2 -> misma razon
  pierce: new Set(["avanzado"]), // estacion 2-3 -> Avanzado (solo posicion 1) queda inservible
  magic: new Set(),
};

// Por clase: solo clases que llevan Pierce/Cut/Blunt en su par pueden usar el rasgo asociado a
// ese tipo. Magic al reves: Yelmo Sellado ("no puede lanzar Magic") no tiene sentido en una clase
// que YA depende de Magic para uno de sus dos tipos.
function classHasType(clase, type) {
  return CLASS_DAMAGE_PAIR[clase].includes(type);
}

const CLASS_ONLY_WITH_TYPE = {
  certero: "pierce",
  perforante: "pierce",
  brutal: "cut",
  preciso: "cut",
  sismico: "blunt",
};
const CLASS_EXCLUDED_WITH_TYPE = {
  yelmo_sellado: "magic",
};

function classCompatible(traitId, clase) {
  const requiredType = CLASS_ONLY_WITH_TYPE[traitId];
  if (requiredType) return classHasType(clase, requiredType);
  const excludedType = CLASS_EXCLUDED_WITH_TYPE[traitId];
  if (excludedType) return !classHasType(clase, excludedType);
  return true;
}

function lineageCompatible(traitId, linaje) {
  if (traitId === "baluarte") return linaje !== "marea"; // contradice Fluvial
  return true; // ancestral: permitido en todos, sobrescribe el rasgo base
}

function codeCompatible(traitId, isPalindrome) {
  if (traitId === "palindromo") return isPalindrome;
  return true;
}

/** Filtra un pool de rasgos (ya del tier correspondiente) por clase/tipo activo/linaje/codigo. */
export function filterPool(pool, { clase, activeType, linaje, isPalindrome }) {
  const stationExcluded = STATION_EXCLUDES[activeType] || new Set();
  return pool.filter(
    (t) =>
      !stationExcluded.has(t.id) &&
      classCompatible(t.id, clase) &&
      lineageCompatible(t.id, linaje) &&
      codeCompatible(t.id, isPalindrome)
  );
}

// Solo relevante para `anomalo` (otorga un segundo rasgo) — pares que no pueden coexistir en la
// misma carta (doc §8.3, tabla "Entre rasgos").
export const MUTUAL_EXCLUSIONS = {
  baluarte: ["errante", "elusivo", "flanqueador", "escurridizo", "avanzado"],
  fortificado: ["fibroso", "coronado"],
  yelmo_sellado: ["coronado", "bicefalo"],
  avanzado: ["atalaya"],
  fulminante: ["paciente", "frenetico"],
  inamovible: ["elusivo", "escurridizo"],
  enjambre: ["senorial", "heredero", "fortificado"],
  estoico: ["renaciente", "detonante", "legado"],
};

export function areMutuallyExclusive(idA, idB) {
  return (MUTUAL_EXCLUSIONS[idA] || []).includes(idB) || (MUTUAL_EXCLUSIONS[idB] || []).includes(idA);
}
