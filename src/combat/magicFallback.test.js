// src/combat/magicFallback.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { attemptMagicFallback } from "./magicFallback.js";

/** Battler sintetico minimo — no hace falta pasar por generateCard/makeBattler para probar la
 * logica de la salida en si, solo los campos que attemptMagicFallback realmente toca. */
function fakeBattler(lineage, { headIntegrity = 0, torsoIntegrity = 3, initiative = 5, strength = 4 } = {}) {
  return {
    card: { lineage, identity: { name: `Test-${lineage}` }, cost: 3 },
    zones: {
      head: { integrity: headIntegrity, plate: 0 },
      torso: { integrity: torsoIntegrity, plate: 0 },
      armMain: { integrity: 3, plate: 0 },
      armOff: { integrity: 2, plate: 0 },
      legs: { integrity: 3, plate: 0 },
    },
    initiative,
    strength,
    fallen: false,
    collapsed: false,
    weaponSwapped: false,
  };
}

test("fundicion: siempre tiene salida, pierde 1 de Iniciativa por lanzamiento, es acumulativo", () => {
  const b = fakeBattler("fundicion", { initiative: 5 });
  const first = attemptMagicFallback(b, "A", { impulsoAvailable: 0, escombrosAvailable: 0, ownBoard: { 1: b, 2: null, 3: null } });
  assert.equal(first.ok, true);
  assert.equal(first.kind, "fundicion_iniciativa");
  assert.equal(b.initiative, 4);
  attemptMagicFallback(b, "A", { impulsoAvailable: 0, escombrosAvailable: 0, ownBoard: { 1: b, 2: null, 3: null } });
  assert.equal(b.initiative, 3, "acumulativo: dos lanzamientos, dos penalizaciones");
});

test("prensa: consume 1 Impulso si hay disponible", () => {
  const b = fakeBattler("prensa");
  const result = attemptMagicFallback(b, "A", { impulsoAvailable: 2, escombrosAvailable: 0, ownBoard: { 1: b } });
  assert.equal(result.ok, true);
  assert.equal(result.kind, "prensa_impulso");
  assert.equal(result.impulsoSpent, 1);
});

test("prensa: falla sin Impulso disponible", () => {
  const b = fakeBattler("prensa");
  const result = attemptMagicFallback(b, "A", { impulsoAvailable: 0, escombrosAvailable: 5, ownBoard: { 1: b } });
  assert.equal(result.ok, false);
});

test("marea: consume 1 Escombro si hay disponible", () => {
  const b = fakeBattler("marea");
  const result = attemptMagicFallback(b, "A", { impulsoAvailable: 0, escombrosAvailable: 3, ownBoard: { 1: b } });
  assert.equal(result.ok, true);
  assert.equal(result.kind, "marea_escombros");
  assert.equal(result.escombrosSpent, 1);
});

test("marea: falla sin Escombros disponibles", () => {
  const b = fakeBattler("marea");
  const result = attemptMagicFallback(b, "A", { impulsoAvailable: 5, escombrosAvailable: 0, ownBoard: { 1: b } });
  assert.equal(result.ok, false);
});

test("injerto: drena 1 de cabeza de un aliado adyacente (posicion +-1)", () => {
  const attacker = fakeBattler("injerto");
  const ally = fakeBattler("prensa", { headIntegrity: 3 });
  const board = { 1: attacker, 2: ally, 3: null };
  const result = attemptMagicFallback(attacker, "A", { impulsoAvailable: 0, escombrosAvailable: 0, ownBoard: board });
  assert.equal(result.ok, true);
  assert.equal(result.kind, "injerto_drena");
  assert.equal(ally.zones.head.integrity, 2);
});

test("injerto: falla sin aliado adyacente (solo en el tablero)", () => {
  const attacker = fakeBattler("injerto");
  const board = { 1: null, 2: attacker, 3: null };
  const result = attemptMagicFallback(attacker, "A", { impulsoAvailable: 0, escombrosAvailable: 0, ownBoard: board });
  assert.equal(result.ok, false);
});

test("injerto: falla si el unico adyacente ya tiene la cabeza rota", () => {
  const attacker = fakeBattler("injerto");
  const brokenAlly = fakeBattler("prensa", { headIntegrity: 0 });
  const board = { 1: attacker, 2: brokenAlly, 3: null };
  const result = attemptMagicFallback(attacker, "A", { impulsoAvailable: 0, escombrosAvailable: 0, ownBoard: board });
  assert.equal(result.ok, false);
});

test("injerto: no drena a si mismo aunque este en el tablero", () => {
  const attacker = fakeBattler("injerto", { headIntegrity: 3 });
  const board = { 1: attacker, 2: null, 3: null };
  const result = attemptMagicFallback(attacker, "A", { impulsoAvailable: 0, escombrosAvailable: 0, ownBoard: board });
  assert.equal(result.ok, false);
});

test("cantera: siempre tiene salida (no depende de ningun recurso externo), consume su propio Torso", () => {
  const b = fakeBattler("cantera", { torsoIntegrity: 3 });
  const result = attemptMagicFallback(b, "A", { impulsoAvailable: 0, escombrosAvailable: 0, ownBoard: { 1: b } });
  assert.equal(result.ok, true);
  assert.equal(result.kind, "cantera_torso");
  assert.equal(result.lethal, false);
  assert.equal(b.zones.torso.integrity, 2);
  assert.equal(b.fallen, false);
});

test("cantera: si el costo mata a la unidad, marca lethal y la deja caida — el motor le suma Fuerza a ESE golpe", () => {
  const b = fakeBattler("cantera", { torsoIntegrity: 1 });
  const result = attemptMagicFallback(b, "A", { impulsoAvailable: 0, escombrosAvailable: 0, ownBoard: { 1: b } });
  assert.equal(result.ok, true);
  assert.equal(result.lethal, true);
  assert.equal(b.zones.torso.integrity, 0);
  assert.equal(b.fallen, true, "applyDamageToZone ya deberia haber disparado la cascada de torso");
});

test("linaje desconocido: no tiene salida definida, falla", () => {
  const b = fakeBattler("linaje_inexistente");
  const result = attemptMagicFallback(b, "A", { impulsoAvailable: 99, escombrosAvailable: 99, ownBoard: { 1: b } });
  assert.equal(result.ok, false);
});
