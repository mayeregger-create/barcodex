// src/cardgen/utils.js
// Helpers sobre el codigo de barras normalizado (13 digitos, string). Nada de esto usa el PRNG —
// son los pasos "sin PRNG" del pipeline (doc Generador de Cartas §4): legibles, un jugador puede
// predecirlos mirando el codigo.

/** UPC-A (12) -> EAN-13 anteponiendo "0". Longitud invalida -> null. No valida digito verificador
 * a proposito (doc §4.1): muchos codigos reales estan mal impresos y rechazarlos frustra sin
 * ganar nada. */
export function normalizeCode(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 12) return "0" + digits;
  if (digits.length === 13) return digits;
  return null;
}

export function digitSum(code) {
  let sum = 0;
  for (const ch of code) sum += Number(ch);
  return sum;
}

export function uniqueDigitCount(code) {
  return new Set(code).size;
}

/** true si hay 3 o mas digitos identicos consecutivos en algun punto del codigo. */
export function hasConsecutiveRepeats(code, minRun = 3) {
  let run = 1;
  for (let i = 1; i < code.length; i++) {
    run = code[i] === code[i - 1] ? run + 1 : 1;
    if (run >= minRun) return true;
  }
  return false;
}

export function isPalindrome(code) {
  for (let i = 0, j = code.length - 1; i < j; i++, j--) {
    if (code[i] !== code[j]) return false;
  }
  return true;
}

export function round(n) {
  return Math.round(n);
}

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
