// src/titiritero/prng.js
// Determinismo del Resolver (doc §5.1): FNV-1a como hash del id de carta -> semilla de mulberry32.
// Nunca Math.random() aca — la misma carta tiene que producir siempre el mismo resultado.

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32: rapido, buena distribucion para esto, sin dependencias. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fabrica un generador [0,1) sembrado deterministicamente a partir de un string (el id de carta). */
export function seededRng(seedStr) {
  return mulberry32(fnv1a(seedStr));
}
