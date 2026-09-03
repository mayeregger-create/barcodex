// src/combat/traits.test.js
// Verifica el subconjunto de rasgos con comportamiento de combate implementado esta sesion:
// brutal, carnicero, ejecutor, runico, escamado, remachado, certero, sismico, estandarte,
// vengativo, reflejo (motor de combate) + abastecedor, leal (economia) + Reparar (Nucleo).
// Todo con battlers sinteticos (no generateCard) para control exacto de cada escenario.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAttack, effectiveFuerza, applyDamageToZone } from "./resolve.js";
import { selectTarget } from "./targeting.js";
import { estandarteBonusFor, resetRoundFlags, positionOf, adjacentPositions, POSITIONS } from "./board.js";
import { escombrosFromDeploy, effectiveDeployCost, commitFromHand } from "./economy.js";
import { findMostDamaged, tryReparar, REPARAR_COST } from "./nucleoAbilities.js";

const ZONE_BASE = { head: 4, torso: 6, armMain: 5, armOff: 5, legs: 5 };

/** Battler sintetico con la forma completa que usa el motor (incluye `card.zones` como la
 * Integridad "de generacion" separada de `zones` en vivo, tal como hace makeBattler). */
function fakeBattler({
  trait = null,
  secondTrait = null,
  activeType = "cut",
  strength = 4,
  initiative = 5,
  cost = 3,
  clase = "warrior",
  overrides = {},
} = {}) {
  const genZones = {};
  const liveZones = {};
  for (const z of Object.keys(ZONE_BASE)) {
    const base = overrides[z]?.integrity ?? ZONE_BASE[z];
    const plate = overrides[z]?.plate ?? 0;
    genZones[z] = { integrity: base, plate, plateResist: plate > 0 ? 1 : 0 };
    liveZones[z] = { integrity: overrides[z]?.liveIntegrity ?? base, plate, everPlated: plate > 0 };
  }
  return {
    card: { identity: { trait, secondTrait, class: clase, name: "Test" }, cost, zones: genZones },
    zones: liveZones,
    strength,
    initiative,
    activeType,
    fallen: false,
    collapsed: false,
    weaponSwapped: false,
    remachadoUsed: false,
    reflejoUsedThisRound: false,
  };
}

function boardWith(entries) {
  const board = { 1: null, 2: null, 3: null };
  for (const [pos, battler] of Object.entries(entries)) board[pos] = battler;
  return board;
}

/** Mata (deja en 0) todas las zonas de `battler` salvo `keepZone` — para forzar que el motor
 * (que siempre elige la zona viva mas debil) no tenga otra opcion que la zona bajo prueba. Sin
 * esto, "torso" nunca gana contra la cabeza (integridad base mas baja) salvo que se la aisle. */
function onlyZone(battler, keepZone) {
  for (const z of Object.keys(battler.zones)) {
    if (z !== keepZone) battler.zones[z].integrity = 0;
  }
  return battler;
}

// ---------- carnicero / ejecutor (resolve.js#hitZone via resolveAttack) ----------

test("carnicero: +2 Fuerza contra una zona sin placa", () => {
  const attacker = fakeBattler({ trait: "carnicero", activeType: "cut", strength: 4 });
  const plain = fakeBattler({ activeType: "cut", strength: 4 });
  const defenderA = onlyZone(fakeBattler({ activeType: "cut", overrides: { torso: { liveIntegrity: 10 } } }), "torso");
  const defenderB = onlyZone(fakeBattler({ activeType: "cut", overrides: { torso: { liveIntegrity: 10 } } }), "torso");
  const nucleo = { hp: 20 };

  resolveAttack(attacker, boardWith({ 1: defenderA }), nucleo, false);
  resolveAttack(plain, boardWith({ 1: defenderB }), nucleo, false);

  const dmgWith = 10 - defenderA.zones.torso.integrity;
  const dmgWithout = 10 - defenderB.zones.torso.integrity;
  assert.equal(dmgWith, dmgWithout + 2);
});

test("ejecutor: +3 Fuerza rematando una zona que ya esta en 1", () => {
  const attacker = fakeBattler({ trait: "ejecutor", activeType: "cut", strength: 3 });
  const defender = onlyZone(fakeBattler({ activeType: "cut", overrides: { torso: { liveIntegrity: 1 } } }), "torso");
  const nucleo = { hp: 20 };

  resolveAttack(attacker, boardWith({ 1: defender }), nucleo, false);
  // Fuerza 3 + 3 (ejecutor) = 6 de dano contra una zona que arranco en 1 -> queda en 0 (clamp).
  assert.equal(defender.zones.torso.integrity, 0);
  assert.equal(defender.fallen, true); // rompio el torso
});

// ---------- brutal (Cut) ----------

test("brutal: Cut contra placa rompe la placa Y pasa 1 de dano de todos modos", () => {
  const attacker = fakeBattler({ trait: "brutal", activeType: "cut", strength: 3 });
  const defender = onlyZone(fakeBattler({ activeType: "cut", overrides: { torso: { liveIntegrity: 5, plate: 1 } } }), "torso");
  const nucleo = { hp: 20 };

  const result = resolveAttack(attacker, boardWith({ 1: defender }), nucleo, false);
  assert.equal(defender.zones.torso.plate, 0);
  assert.equal(defender.zones.torso.integrity, 4); // 5 - 1
  assert.equal(result.hits[0].plateChipped, true);
  assert.equal(result.hits[0].integrityDamage, 1);
});

test("sin brutal: Cut contra placa solo la rompe, cero dano de Integridad", () => {
  const attacker = fakeBattler({ activeType: "cut", strength: 3 });
  const defender = onlyZone(fakeBattler({ activeType: "cut", overrides: { torso: { liveIntegrity: 5, plate: 1 } } }), "torso");
  resolveAttack(attacker, boardWith({ 1: defender }), { hp: 20 }, false);
  assert.equal(defender.zones.torso.plate, 0);
  assert.equal(defender.zones.torso.integrity, 5);
});

// ---------- runico (defensor) ----------

test("runico: las placas del defensor tambien bloquean Magic (que normalmente la ignora)", () => {
  const attacker = fakeBattler({ activeType: "magic", strength: 3 });
  const defender = onlyZone(fakeBattler({ trait: "runico", activeType: "cut", overrides: { torso: { liveIntegrity: 5, plate: 1 } } }), "torso");
  const result = resolveAttack(attacker, boardWith({ 1: defender }), { hp: 20 }, false);
  assert.equal(defender.zones.torso.integrity, 5, "runico deberia bloquear el dano de Magic mientras la placa aguante");
  assert.equal(result.hits[0].integrityDamage, 0);
});

test("sin runico: Magic ignora la placa como siempre", () => {
  const attacker = fakeBattler({ activeType: "magic", strength: 3 });
  const defender = onlyZone(fakeBattler({ activeType: "cut", overrides: { torso: { liveIntegrity: 5, plate: 1 } } }), "torso");
  resolveAttack(attacker, boardWith({ 1: defender }), { hp: 20 }, false);
  assert.equal(defender.zones.torso.integrity, 2); // 5 - 3, la placa no lo protege
});

// ---------- remachado (defensor) ----------

test("remachado: la primera placa que se rompe se repone al toque, una sola vez", () => {
  const attacker = fakeBattler({ activeType: "cut", strength: 2 });
  const defender = onlyZone(
    fakeBattler({ trait: "remachado", activeType: "cut", overrides: { torso: { liveIntegrity: 10, plate: 1 } } }),
    "torso"
  );
  const board = boardWith({ 1: defender });

  resolveAttack(attacker, board, { hp: 20 }, false); // rompe placa de torso -> se repone (remachadoUsed=true)
  assert.equal(defender.zones.torso.plate, 1);
  assert.equal(defender.remachadoUsed, true);

  // segunda placa rota (torso otra vez, ya no tiene mas usos) -> esta vez SI se pierde
  resolveAttack(attacker, board, { hp: 20 }, false);
  assert.equal(defender.zones.torso.plate, 0);
});

// ---------- escamado (defensor, targeting) ----------
// Pierce solo alcanza posiciones 2-3 (su Estacion/Alcance) — los defensores van en pos.2 aca.

test("escamado: una placa rota deja un resto que sigue bloqueando Pierce", () => {
  const defender = onlyZone(
    fakeBattler({ trait: "escamado", overrides: { torso: { liveIntegrity: 5, plate: 0 } } }),
    "torso"
  );
  defender.zones.torso.everPlated = true; // ya tuvo placa alguna vez, ahora esta en 0
  const attacker = fakeBattler({ activeType: "pierce" });
  const target = selectTarget(attacker, boardWith({ 2: defender }), false);
  assert.equal(target, null, "torso es la unica zona viva y el residuo la sigue bloqueando");
});

test("sin escamado: una zona con placa ya en 0 es un blanco normal para Pierce", () => {
  const defender = onlyZone(fakeBattler({ overrides: { torso: { liveIntegrity: 5, plate: 0 } } }), "torso");
  defender.zones.torso.everPlated = true;
  const attacker = fakeBattler({ activeType: "pierce" });
  const target = selectTarget(attacker, boardWith({ 2: defender }), false);
  assert.deepEqual(target, { position: 2, zones: ["torso"] });
});

// ---------- certero (atacante, targeting + dano) ----------

test("certero: Pierce puede apuntar a una zona con placa, a mitad de Fuerza", () => {
  const attacker = fakeBattler({ trait: "certero", activeType: "pierce", strength: 4 });
  const defender = onlyZone(fakeBattler({ overrides: { torso: { liveIntegrity: 10, plate: 1 } } }), "torso");
  const result = resolveAttack(attacker, boardWith({ 2: defender }), { hp: 20 }, false);
  assert.equal(result.kind, "hit_unit");
  assert.equal(defender.zones.torso.integrity, 8); // 10 - ceil(4/2)
});

test("sin certero: Pierce no puede elegir ninguna zona si todas tienen placa", () => {
  const attacker = fakeBattler({ activeType: "pierce" });
  const defender = fakeBattler({ overrides: { torso: { liveIntegrity: 10, plate: 1 }, head: { liveIntegrity: 10, plate: 1 }, armMain: { liveIntegrity: 10, plate: 1 }, armOff: { liveIntegrity: 10, plate: 1 }, legs: { liveIntegrity: 10, plate: 1 } } });
  const target = selectTarget(attacker, boardWith({ 2: defender }), false);
  assert.equal(target, null);
});

// ---------- sismico (atacante, Blunt) ----------

test("sismico: Blunt golpea 3 zonas contiguas en vez de 2", () => {
  const attacker = fakeBattler({ trait: "sismico", activeType: "blunt" });
  const defender = fakeBattler();
  const target = selectTarget(attacker, boardWith({ 1: defender }), false);
  assert.equal(target.zones.length, 3);
  assert.equal(target.zones[0], "torso");
});

test("sin sismico: Blunt golpea solo torso + 1 zona contigua", () => {
  const attacker = fakeBattler({ activeType: "blunt" });
  const defender = fakeBattler();
  const target = selectTarget(attacker, boardWith({ 1: defender }), false);
  assert.equal(target.zones.length, 2);
});

// ---------- estandarte (aura) ----------

test("estandarte: +1 Fuerza por cada aliado ADYACENTE que lo tenga (no cuenta a si mismo)", () => {
  // topologia lineal 1-2-3: pos.2 es adyacente a AMBAS pos.1 y pos.3; pos.1 y pos.3 NO son
  // adyacentes entre si (esa es la comparacion real, no "pos.2 vs pos.3").
  const withStandard = fakeBattler({ trait: "estandarte" });
  const edge1 = fakeBattler();
  const edge3 = fakeBattler({ trait: "estandarte" });
  const board = boardWith({ 1: edge1, 2: withStandard, 3: edge3 });
  assert.equal(estandarteBonusFor(withStandard, board), 1, "pos.2 solo ve el estandarte de pos.3, no cuenta el propio");
  assert.equal(estandarteBonusFor(edge1, board), 1, "pos.1 ve el estandarte de pos.2 (adyacente)");
  assert.equal(estandarteBonusFor(edge3, board), 1, "pos.3 ve el estandarte de pos.2 (adyacente), no el propio");
});

test("estandarte: los extremos (pos.1 y pos.3) no son adyacentes entre si", () => {
  const edge1 = fakeBattler();
  const edge3 = fakeBattler({ trait: "estandarte" });
  const board = boardWith({ 1: edge1, 3: edge3 }); // pos.2 vacia a proposito
  assert.equal(estandarteBonusFor(edge1, board), 0, "pos.1 y pos.3 estan a distancia 2, no son adyacentes");
});

test("estandarte: fuera del tablero (no colocado) da bono 0, no rompe", () => {
  const orphan = fakeBattler();
  assert.equal(estandarteBonusFor(orphan, boardWith({ 1: fakeBattler({ trait: "estandarte" }) })), 0);
});

// ---------- vengativo (dinamico, effectiveFuerza) ----------

test("vengativo: +1 Fuerza efectiva por cada zona propia rota", () => {
  const battler = fakeBattler({
    trait: "vengativo",
    activeType: "cut", // tope 4+2=6, con margen para ver el bono sin clampear
    strength: 3,
    overrides: { head: { liveIntegrity: 0 }, armMain: { liveIntegrity: 0 } },
  });
  assert.equal(effectiveFuerza(battler), 5); // 3 base + 2 zonas rotas
});

test("vengativo: el bono sigue respetando el tope de Fuerza del tipo de dano", () => {
  const battler = fakeBattler({
    trait: "vengativo",
    activeType: "blunt", // tope 3+2=5
    strength: 4,
    overrides: { head: { liveIntegrity: 0 }, armMain: { liveIntegrity: 0 }, armOff: { liveIntegrity: 0 } },
  });
  assert.equal(effectiveFuerza(battler), 5, "4+3=7 pero el tope de Blunt (5) sigue aplicando");
});

// ---------- reflejo (defensor, contraataque) ----------

test("reflejo: si el defensor sobrevive, contraataca una vez", () => {
  const attacker = onlyZone(fakeBattler({ activeType: "cut", strength: 3 }), "torso");
  const defender = onlyZone(
    fakeBattler({ trait: "reflejo", activeType: "cut", strength: 2, overrides: { torso: { liveIntegrity: 10 } } }),
    "torso"
  );
  const result = resolveAttack(attacker, boardWith({ 1: defender }), { hp: 20 }, false);
  assert.ok(result.reflejo, "deberia haber contraatacado");
  assert.equal(attacker.zones.torso.integrity, 4); // 6 base - 2 (fuerza del defensor)
});

test("reflejo: no se dispara dos veces en la misma ronda", () => {
  const attacker = onlyZone(fakeBattler({ activeType: "cut", strength: 1 }), "torso");
  const defender = onlyZone(
    fakeBattler({ trait: "reflejo", activeType: "cut", strength: 1, overrides: { torso: { liveIntegrity: 10 } } }),
    "torso"
  );
  const board = boardWith({ 1: defender });
  const r1 = resolveAttack(attacker, board, { hp: 20 }, false);
  const r2 = resolveAttack(attacker, board, { hp: 20 }, false);
  assert.ok(r1.reflejo);
  assert.equal(r2.reflejo, undefined, "reflejoUsedThisRound deberia impedir un segundo contraataque");
});

test("resetRoundFlags: devuelve Reflejo disponible para la ronda siguiente", () => {
  const defender = fakeBattler({ trait: "reflejo" });
  defender.reflejoUsedThisRound = true;
  resetRoundFlags(boardWith({ 1: defender }));
  assert.equal(defender.reflejoUsedThisRound, false);
});

test("reflejo: no contraataca si el golpe lo tumba", () => {
  const attacker = fakeBattler({ activeType: "cut", strength: 10 });
  const defender = fakeBattler({ trait: "reflejo", activeType: "cut", overrides: { torso: { liveIntegrity: 2 } } });
  const result = resolveAttack(attacker, boardWith({ 1: defender }), { hp: 20 }, false);
  assert.equal(defender.fallen, true);
  assert.equal(result.reflejo, undefined);
});

// ---------- abastecedor / leal (economia) ----------

test("abastecedor: otorga 1 Escombro al desplegarse", () => {
  const card = { identity: { trait: "abastecedor", secondTrait: null } };
  assert.equal(escombrosFromDeploy(card), 1);
});

test("sin abastecedor: 0 Escombros", () => {
  const card = { identity: { trait: "leal", secondTrait: null } };
  assert.equal(escombrosFromDeploy(card), 0);
});

test("leal: Coste de despliegue -2 (minimo 1) si comparte Clase con el Regente", () => {
  const card = { identity: { trait: "leal", secondTrait: null, class: "warrior" }, cost: 3 };
  assert.equal(effectiveDeployCost(card, "warrior"), 1);
  assert.equal(effectiveDeployCost(card, "rogue"), 3, "distinta Clase: sin descuento");
  assert.equal(effectiveDeployCost(card, null), 3, "sin Regente conocido: sin descuento");
});

test("leal: el descuento nunca baja de 1", () => {
  const card = { identity: { trait: "leal", secondTrait: null, class: "warrior" }, cost: 2 };
  assert.equal(effectiveDeployCost(card, "warrior"), 1);
});

test("commitFromHand: respeta el Coste efectivo (leal) al decidir que entra", () => {
  const lealCard = { identity: { trait: "leal", secondTrait: null, class: "warrior" }, cost: 3, code: "leal" };
  const plainCard = { identity: { trait: null, secondTrait: null, class: "rogue" }, cost: 3, code: "plain" };
  // con Impulso 1: la carta leal (coste efectivo 1) entra, la otra (coste 3) no.
  const res = commitFromHand([lealCard, plainCard], 1, "warrior");
  assert.deepEqual(res.committed.map((c) => c.code), ["leal"]);
  assert.equal(res.impulsoLeft, 0);
});

// ---------- Reparar (habilidad de Nucleo, Escombros) ----------

test("findMostDamaged: elige la zona viva con mayor dano acumulado", () => {
  const b1 = fakeBattler({ overrides: { torso: { liveIntegrity: 4 } } }); // 6 base, falta 2
  const b2 = fakeBattler({ overrides: { head: { liveIntegrity: 1 } } }); // 4 base, falta 3
  const board = boardWith({ 1: b1, 2: b2 });
  const best = findMostDamaged(board);
  assert.equal(best.position, 2);
  assert.equal(best.zone, "head");
});

test("findMostDamaged: null si nadie esta dañado", () => {
  const board = boardWith({ 1: fakeBattler() });
  assert.equal(findMostDamaged(board), null);
});

test("tryReparar: falla sin Escombros suficientes", () => {
  const board = boardWith({ 1: fakeBattler({ overrides: { torso: { liveIntegrity: 3 } } }) });
  const escombros = { A: REPARAR_COST - 1 };
  assert.equal(tryReparar(board, escombros, "A"), false);
  assert.equal(escombros.A, REPARAR_COST - 1, "no deberia gastar nada si falla");
});

test("tryReparar: repara 1 de Integridad y descuenta el costo", () => {
  const b = fakeBattler({ overrides: { torso: { liveIntegrity: 3 } } });
  const board = boardWith({ 1: b });
  const escombros = { A: REPARAR_COST };
  const applied = tryReparar(board, escombros, "A");
  assert.ok(applied);
  assert.equal(b.zones.torso.integrity, 4);
  assert.equal(escombros.A, 0);
});

test("tryReparar: falla si hay Escombros pero nadie esta dañado", () => {
  const board = boardWith({ 1: fakeBattler() });
  const escombros = { A: 10 };
  assert.equal(tryReparar(board, escombros, "A"), false);
  assert.equal(escombros.A, 10);
});

// ---------- topologia de tablero ----------

test("positionOf / adjacentPositions: sanity basica", () => {
  const b = fakeBattler();
  const board = boardWith({ 2: b });
  assert.equal(positionOf(b, board), 2);
  assert.equal(positionOf(fakeBattler(), board), null);
  assert.deepEqual(adjacentPositions(2).sort(), [1, 3]);
  assert.deepEqual(adjacentPositions(1), [2]);
});
