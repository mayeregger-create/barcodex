// src/combat/traits.test.js
// Verifica el subconjunto de rasgos con comportamiento de combate implementado en esta sesion y
// las siguientes: brutal, carnicero, ejecutor, runico, escamado, remachado, certero, sismico,
// estandarte, vengativo, reflejo, diestro, yelmo_sellado, escurridizo, fulminante, paciente,
// sereno, flanqueador, avanzado, atalaya, gemelo, implacable, frenetico (motor de combate) +
// abastecedor, leal (economia) + Reparar (Nucleo). Todo con battlers sinteticos (no generateCard)
// para control exacto de cada escenario.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAttack, effectiveFuerza, applyDamageToZone, applyPostAttackTraits } from "./resolve.js";
import { selectTarget } from "./targeting.js";
import { estandarteBonusFor, resetRoundFlags, positionOf, adjacentPositions, legalStationFor, POSITIONS } from "./board.js";
import { escombrosFromDeploy, effectiveDeployCost, commitFromHand } from "./economy.js";
import { findMostDamaged, tryReparar, REPARAR_COST } from "./nucleoAbilities.js";
import { buildTurnOrder } from "./simulate.js";
import { resolveTurn } from "./turnResolution.js";

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
    card: { identity: { trait, secondTrait, class: clase, name: "Test" }, cost, zones: genZones, combat: { damageTypeActive: activeType } },
    zones: liveZones,
    strength,
    initiative,
    activeType,
    fallen: false,
    collapsed: false,
    weaponSwapped: false,
    remachadoUsed: false,
    reflejoUsedThisRound: false,
    pacienteStacks: 0,
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

// ---------- diestro ----------

test("diestro: perder el brazo principal no reduce la Fuerza al cambiar de mano", () => {
  const kill0 = { liveIntegrity: 0 };
  const attacker = fakeBattler({ activeType: "cut", strength: 5 });
  const defender = fakeBattler({
    trait: "diestro",
    activeType: "cut",
    strength: 4,
    overrides: { head: kill0, torso: kill0, legs: kill0, armMain: { liveIntegrity: 1 }, armOff: { liveIntegrity: 5 } },
  });
  resolveAttack(attacker, boardWith({ 1: defender }), { hp: 20 }, false);
  assert.equal(defender.zones.armMain.integrity, 0);
  assert.equal(defender.weaponSwapped, true);
  assert.equal(defender.strength, 4, "diestro: sin penalizacion de -2");
});

test("sin diestro: cambiar de mano SI penaliza -2 Fuerza", () => {
  const kill0 = { liveIntegrity: 0 };
  const attacker = fakeBattler({ activeType: "cut", strength: 5 });
  const defender = fakeBattler({
    activeType: "cut",
    strength: 4,
    overrides: { head: kill0, torso: kill0, legs: kill0, armMain: { liveIntegrity: 1 }, armOff: { liveIntegrity: 5 } },
  });
  resolveAttack(attacker, boardWith({ 1: defender }), { hp: 20 }, false);
  assert.equal(defender.weaponSwapped, true);
  assert.equal(defender.strength, 2, "sin diestro: -2 Fuerza");
});

// ---------- yelmo_sellado ----------

test("yelmo_sellado: la cabeza es inmune a todo dano, sin importar el tipo", () => {
  const attacker = fakeBattler({ activeType: "magic", strength: 5 });
  const defender = onlyZone(fakeBattler({ trait: "yelmo_sellado" }), "head");
  const result = resolveAttack(attacker, boardWith({ 1: defender }), { hp: 20 }, false);
  assert.equal(result.kind, "no_target", "sin otra zona viva, ni Magic puede tocar la cabeza sellada");
  assert.equal(defender.zones.head.integrity, ZONE_BASE.head);
});

test("yelmo_sellado: el targeting rutea a otra zona viva en vez de desperdiciar el turno en la cabeza inmune", () => {
  const kill0 = { liveIntegrity: 0 };
  const attacker = fakeBattler({ activeType: "cut", strength: 3 });
  const defender = fakeBattler({ trait: "yelmo_sellado", overrides: { armMain: kill0, armOff: kill0, legs: kill0 } });
  // vivos: head(4, inmune) y torso(6) — sin la inmunidad, Cut elegiria cabeza por ser mas debil.
  const result = resolveAttack(attacker, boardWith({ 1: defender }), { hp: 20 }, false);
  assert.equal(result.kind, "hit_unit");
  assert.deepEqual(result.zones, ["torso"]);
});

// ---------- escurridizo ----------

test("escurridizo: esquiva un ataque Pierce entero, sin placa ni dano", () => {
  const attacker = fakeBattler({ activeType: "pierce", strength: 4 });
  const defender = onlyZone(fakeBattler({ trait: "escurridizo" }), "torso");
  const result = resolveAttack(attacker, boardWith({ 2: defender }), { hp: 20 }, false); // pierce alcanza pos 2-3
  assert.equal(result.kind, "dodged");
  assert.equal(defender.zones.torso.integrity, ZONE_BASE.torso);
});

test("escurridizo: NO esquiva ataques que no son Pierce", () => {
  const attacker = fakeBattler({ activeType: "cut", strength: 3 });
  const defender = onlyZone(fakeBattler({ trait: "escurridizo" }), "torso");
  const result = resolveAttack(attacker, boardWith({ 1: defender }), { hp: 20 }, false);
  assert.equal(result.kind, "hit_unit");
});

// ---------- fulminante / paciente (orden de turno) ----------

test("fulminante: actua antes que cualquiera, sin importar Iniciativa", () => {
  const slow = fakeBattler({ trait: "fulminante", initiative: 1 });
  const fast = fakeBattler({ initiative: 20 });
  const order = buildTurnOrder(boardWith({ 1: slow }), boardWith({ 1: fast }), "A");
  assert.equal(order[0].battler, slow);
  assert.equal(order[1].battler, fast);
});

test("paciente: siempre actua ultimo, sin importar Iniciativa", () => {
  const patient = fakeBattler({ trait: "paciente", initiative: 20 });
  const normal = fakeBattler({ initiative: 1 });
  const order = buildTurnOrder(boardWith({ 1: patient }), boardWith({ 1: normal }), "A");
  assert.equal(order[0].battler, normal);
  assert.equal(order[1].battler, patient);
});

// ---------- paciente (Fuerza acumulada) ----------

test("paciente: acumula +2 Fuerza cada vez que no logra atacar", () => {
  const battler = fakeBattler({ trait: "paciente", activeType: "pierce", strength: 3 });
  applyPostAttackTraits(battler, { kind: "no_target" });
  assert.equal(battler.pacienteStacks, 2);
  applyPostAttackTraits(battler, { kind: "no_magic_head_broken" });
  assert.equal(battler.pacienteStacks, 4);
  applyPostAttackTraits(battler, { kind: "hit_unit" }); // SI ataco: no suma
  assert.equal(battler.pacienteStacks, 4);
});

test("paciente: el stack acumulado se refleja en la Fuerza efectiva", () => {
  const battler = fakeBattler({ trait: "paciente", activeType: "cut", strength: 2 }); // tope cut = 4+2=6
  battler.pacienteStacks = 3;
  assert.equal(effectiveFuerza(battler), 5);
});

// ---------- sereno ----------

test("sereno: si no ataco, repone 1 placa al final de la ronda", () => {
  const battler = fakeBattler({ trait: "sereno", overrides: { torso: { plate: 1, liveIntegrity: 5 } } });
  battler.zones.torso.plate = 0; // ya se le habia roto antes en la partida
  applyPostAttackTraits(battler, { kind: "no_target" });
  assert.equal(battler.zones.torso.plate, 1);
});

test("sereno: si SI ataco, no repone nada", () => {
  const battler = fakeBattler({ trait: "sereno", overrides: { torso: { plate: 1, liveIntegrity: 5 } } });
  battler.zones.torso.plate = 0;
  applyPostAttackTraits(battler, { kind: "hit_unit" });
  assert.equal(battler.zones.torso.plate, 0);
});

test("sereno: no repone una zona que nunca tuvo placa", () => {
  const battler = fakeBattler({ trait: "sereno" });
  applyPostAttackTraits(battler, { kind: "no_target" });
  for (const z of Object.keys(battler.zones)) assert.equal(battler.zones[z].plate, 0);
});

// ---------- flanqueador / avanzado / atalaya (despliegue) ----------

test("flanqueador: puede desplegarse en cualquier posicion, sin importar su tipo de dano", () => {
  const card = fakeBattler({ trait: "flanqueador", activeType: "pierce" }).card; // pierce normalmente solo 2-3
  assert.deepEqual(legalStationFor(card).slice().sort(), [1, 2, 3]);
});

test("avanzado: siempre entra en posicion 1, sin importar su tipo de dano", () => {
  const card = fakeBattler({ trait: "avanzado", activeType: "pierce" }).card;
  assert.deepEqual(legalStationFor(card), [1]);
});

test("atalaya: siempre entra en posicion 3, sin importar su tipo de dano", () => {
  const card = fakeBattler({ trait: "atalaya", activeType: "blunt" }).card;
  assert.deepEqual(legalStationFor(card), [3]);
});

test("sin rasgos de posicion: la Estacion normal del tipo de dano sigue aplicando", () => {
  const card = fakeBattler({ activeType: "pierce" }).card;
  assert.deepEqual(legalStationFor(card), [2, 3]);
});

// ---------- atalaya (Alcance +1) ----------

test("atalaya: Alcance +1 le deja llegar a cualquier posicion, no solo el Alcance normal de su tipo", () => {
  const attacker = fakeBattler({ trait: "atalaya", activeType: "pierce" }); // pierce alcance normal = [2,3]
  const defenderAt1 = onlyZone(fakeBattler(), "torso");
  const target = selectTarget(attacker, boardWith({ 1: defenderAt1 }), false);
  assert.ok(target && target.position === 1, "atalaya deberia poder alcanzar la posicion 1, fuera del alcance normal de Pierce");
});

test("sin atalaya: Pierce no alcanza la posicion 1", () => {
  const attacker = fakeBattler({ activeType: "pierce" });
  const defenderAt1 = onlyZone(fakeBattler(), "torso");
  const target = selectTarget(attacker, boardWith({ 1: defenderAt1 }), false);
  assert.equal(target, null);
});

// ---------- gemelo / implacable / frenetico (turnResolution.js) ----------

function fakeCtx({ ownBoard, defBoard, escombros = { A: 0, B: 0 }, impulso = 0, round = 10 } = {}) {
  let localImpulso = impulso;
  return {
    ownBoard,
    defBoard,
    defNucleo: { hp: 20 },
    escombros,
    getImpulso: () => localImpulso,
    spendImpulso: (n) => { localImpulso -= n; },
    round,
    nucleoShieldRounds: 3,
    lineOfSight: false,
  };
}

test("gemelo: ataca dos veces en el mismo turno, cada golpe a la mitad de Fuerza", () => {
  const attacker = fakeBattler({ trait: "gemelo", activeType: "cut", strength: 4 }); // tope cut=6, sin clamp
  const defender = onlyZone(fakeBattler({ overrides: { torso: { liveIntegrity: 10 } } }), "torso");
  const ctx = fakeCtx({ ownBoard: boardWith({ 1: attacker }), defBoard: boardWith({ 1: defender }) });
  const results = resolveTurn(attacker, "A", ctx);
  assert.equal(results.length, 2);
  assert.equal(results[0].integrityDamage, 2); // ceil(4*0.5)
  assert.equal(results[1].integrityDamage, 2);
  assert.equal(defender.zones.torso.integrity, 6); // 10 - 2 - 2
});

test("gemelo: si el primer golpe tumba al unico defensor, el segundo sigue de largo al Nucleo (no revienta)", () => {
  const attacker = fakeBattler({ trait: "gemelo", activeType: "cut", strength: 10 });
  const defender = onlyZone(fakeBattler({ overrides: { torso: { liveIntegrity: 1 } } }), "torso");
  const ctx = fakeCtx({ ownBoard: boardWith({ 1: attacker }), defBoard: boardWith({ 1: defender }) });
  const results = resolveTurn(attacker, "A", ctx);
  assert.equal(results.length, 2);
  assert.equal(results[0].kind, "hit_unit");
  assert.equal(defender.fallen, true);
  assert.equal(results[1].kind, "hit_nucleo", "sin defensores en pie, cualquier tipo alcanza el Nucleo (doc §2.2) — el 2do golpe de Gemelo no se pierde");
});

test("implacable: si rompe una zona, ataca de nuevo a Fuerza completa (1 vez por ronda)", () => {
  const attacker = fakeBattler({ trait: "implacable", activeType: "cut", strength: 5 });
  const defender = fakeBattler({ overrides: { armOff: { liveIntegrity: 1 }, head: { liveIntegrity: 10 } } });
  const ctx = fakeCtx({ ownBoard: boardWith({ 1: attacker }), defBoard: boardWith({ 1: defender }) });
  const results = resolveTurn(attacker, "A", ctx);
  assert.equal(results.length, 2, "un golpe extra exactamente — no encadena mas de 1 vez por ronda");
  assert.equal(defender.zones.armOff.integrity, 0);
  assert.equal(defender.zones.armMain.integrity, 0, "el golpe extra (Fuerza 5 completa) tambien rompio armMain");
  assert.equal(attacker.implacableUsedThisRound, true);
});

test("implacable: sin romper ninguna zona, no ataca de nuevo", () => {
  const attacker = fakeBattler({ trait: "implacable", activeType: "cut", strength: 1 });
  const defender = fakeBattler({ overrides: { armOff: { liveIntegrity: 10 }, head: { liveIntegrity: 10 } } });
  const ctx = fakeCtx({ ownBoard: boardWith({ 1: attacker }), defBoard: boardWith({ 1: defender }) });
  const results = resolveTurn(attacker, "A", ctx);
  assert.equal(results.length, 1);
});

test("implacable: no dispara si ya se uso esta ronda", () => {
  const attacker = fakeBattler({ trait: "implacable", activeType: "cut", strength: 5 });
  attacker.implacableUsedThisRound = true;
  const defender = fakeBattler({ overrides: { armOff: { liveIntegrity: 1 }, head: { liveIntegrity: 10 } } });
  const ctx = fakeCtx({ ownBoard: boardWith({ 1: attacker }), defBoard: boardWith({ 1: defender }) });
  const results = resolveTurn(attacker, "A", ctx);
  assert.equal(results.length, 1);
});

test("frenetico: recibe una segunda entrada en la cola de turno", () => {
  const f = fakeBattler({ trait: "frenetico", initiative: 5 });
  const normal = fakeBattler({ initiative: 3 });
  const order = buildTurnOrder(boardWith({ 1: f }), boardWith({ 1: normal }), "A");
  assert.equal(order.length, 3);
  assert.equal(order.filter((e) => e.battler === f).length, 2);
});

test("frenetico: cada accion (via resolveTurn) usa la mitad de Fuerza", () => {
  const attacker = fakeBattler({ trait: "frenetico", activeType: "cut", strength: 4 });
  const defender = onlyZone(fakeBattler({ overrides: { torso: { liveIntegrity: 10 } } }), "torso");
  const ctx = fakeCtx({ ownBoard: boardWith({ 1: attacker }), defBoard: boardWith({ 1: defender }) });
  const results = resolveTurn(attacker, "A", ctx);
  assert.equal(results.length, 1, "frenetico no duplica DENTRO de resolveTurn, eso lo hace la cola de turno");
  assert.equal(results[0].integrityDamage, 2); // ceil(4*0.5)
});

test("sin gemelo/frenetico: un solo golpe a Fuerza completa", () => {
  const attacker = fakeBattler({ activeType: "cut", strength: 4 });
  const defender = onlyZone(fakeBattler({ overrides: { torso: { liveIntegrity: 10 } } }), "torso");
  const ctx = fakeCtx({ ownBoard: boardWith({ 1: attacker }), defBoard: boardWith({ 1: defender }) });
  const results = resolveTurn(attacker, "A", ctx);
  assert.equal(results.length, 1);
  assert.equal(results[0].integrityDamage, 4);
});
