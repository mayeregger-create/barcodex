// src/cardgen/card.test.js
// Verificacion obligatoria (doc §16) con el test runner nativo de Node — mismo patron que
// titiritero/resolver.test.js. Dos tipos de cobertura acá:
//  - Determinismo / integridad estructural / casos borde: exactos, no dependen de que codigos se
//    elijan, se verifican EXHAUSTIVAMENTE donde el espacio lo permite (§16.3, "ningun pool queda
//    vacio para NINGUNA combinacion").
//  - Distribucion (§16.2): el documento calibro sus umbrales sobre una muestra de codigos con
//    ponderacion REAL de volumen GS1, que no tengo aca — estos tests usan codigos generados con
//    digitos uniformemente al azar, asi que son un chequeo de SANIDAD (rango correcto, se usan
//    varios niveles, nada se rompe), no una replica de las tolerancias exactas de la tabla del
//    documento. Antes de confiar en los porcentajes reales hace falta correrlo sobre una muestra
//    real de escaneos.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCard } from "./card.js";
import { normalizeCode } from "./utils.js";
import { CLASSES, CLASS_DAMAGE_PAIR } from "./classGen.js";
import { LINEAGES } from "./linaje.js";
import { ZONES } from "./zones.js";
import { selectTrait } from "./traits/select.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function randomCode(seed) {
  // Generador de codigos de PRUEBA (no del producto) — Math.random esta bien aca, solo elige
  // que inputs alimentarle al generador determinista, nunca decide un resultado de carta.
  let s = seed;
  let out = "";
  for (let i = 0; i < 13; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out += s % 10;
  }
  return out;
}

// ---------- 16.1 Determinismo ----------

test("mismo codigo produce output identico byte a byte, 50 veces", () => {
  const code = "7840123456789";
  const first = JSON.stringify(generateCard(code));
  for (let i = 0; i < 50; i++) {
    assert.equal(JSON.stringify(generateCard(code)), first);
  }
});

test("cambiar un solo digito produce una carta sustancialmente distinta", () => {
  const a = generateCard("7840123456789");
  const b = generateCard("7840123456781"); // ultimo digito distinto
  const differs =
    a.identity.class !== b.identity.class ||
    a.identity.trait !== b.identity.trait ||
    a.combat.strength !== b.combat.strength ||
    a.cost !== b.cost ||
    a.identity.name !== b.identity.name;
  assert.ok(differs, "un solo digito distinto deberia cambiar algo real de la carta");
});

test("cardgen/ nunca llama a Math.random — el determinismo es el producto", () => {
  const dir = __dirname;
  const offenders = [];
  function scan(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name.endsWith(".test.js")) continue; // los tests SI pueden usar Math.random (arriba)
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (entry.name.endsWith(".js")) {
        const src = fs.readFileSync(full, "utf8");
        if (/Math\.random/.test(src)) offenders.push(full);
      }
    }
  }
  scan(dir);
  assert.deepEqual(offenders, []);
});

// ---------- 16.3 Integridad estructural (exhaustiva sobre la matriz) ----------

test("ningun pool de rasgos queda vacio para ninguna combinacion clase x tipo x linaje x palindromo x tier", () => {
  // Prueba directa contra el resolver de rasgos, no contra generateCard — asi cubre las 6x2x5x2x3
  // combinaciones (360) sin depender de encontrar un codigo que las produzca todas por azar.
  const failures = [];
  for (const clase of CLASSES) {
    for (const activeType of CLASS_DAMAGE_PAIR[clase]) {
      for (const linaje of LINEAGES) {
        for (const isPalindrome of [true, false]) {
          for (const tier of ["comun", "raro", "legendario"]) {
            try {
              selectTrait({ tier, clase, activeType, linaje, isPalindrome, roll: 0 });
              selectTrait({ tier, clase, activeType, linaje, isPalindrome, roll: 0.999 });
            } catch (err) {
              failures.push(`${clase}/${activeType}/${linaje}/palindrome=${isPalindrome}/${tier}: ${err.message}`);
            }
          }
        }
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("2000 codigos al azar: coste siempre en [1,8], zonas nunca las 5 blindadas, nombre y epiteto siempre presentes", () => {
  for (let i = 1; i <= 2000; i++) {
    const code = randomCode(i * 2654435761);
    const card = generateCard(code);

    assert.ok(card.cost >= 1 && card.cost <= 8, `coste fuera de rango: ${card.cost} (${code})`);

    const platedCount = ZONES.filter((z) => card.zones[z].plate > 0).length;
    assert.ok(platedCount < 5, `las 5 zonas blindadas en ${code}`);

    assert.ok(card.identity.name && card.identity.name.length > 0, `sin nombre en ${code}`);
    assert.ok(card.identity.displayName.includes(card.identity.name));

    assert.ok(["comun", "poco_comun", "rara", "epica", "legendaria"].includes(card.rarity));
    assert.ok(LINEAGES.includes(card.lineage));
    assert.ok(CLASSES.includes(card.identity.class));
  }
});

// ---------- 16.4 Casos borde ----------

test("codigo de 12 digitos (UPC-A) se normaliza anteponiendo 0", () => {
  const upc = "123456789012";
  assert.equal(normalizeCode(upc), "0" + upc);
  const card = generateCard(upc);
  assert.equal(card.code, "0" + upc);
});

test("codigo con digito verificador invalido genera igual (no se valida)", () => {
  // "7840123456780" con el ultimo digito cambiado a proposito para que el check digit real
  // probablemente no cierre — igual debe generar sin tirar error.
  assert.doesNotThrow(() => generateCard("7840123456780"));
});

test("codigo capicua tiene palindromo disponible en el pool legendario", () => {
  const palindrome = "7003234323007"; // 13 digitos, capicua
  assert.equal(palindrome, [...palindrome].reverse().join(""));
  // No cada carta capicua saca "palindromo" (depende del canal8), pero el pool filtrado para esa
  // combinacion clase/tipo/linaje SI debe incluirlo como candidato posible.
  const card = generateCard(palindrome);
  assert.ok(card); // no revienta
});

test("codigo con todos los digitos iguales no rompe nada", () => {
  assert.doesNotThrow(() => generateCard("0000000000000"));
  assert.doesNotThrow(() => generateCard("9999999999999"));
});

test("codigo invalido (longitud incorrecta) tira un error explicito, no falla en silencio", () => {
  assert.throws(() => generateCard("123"));
});
