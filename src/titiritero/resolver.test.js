// src/titiritero/resolver.test.js
// Cubre el criterio de aceptacion de la Tarea 1: misma carta -> mismo resultado siempre, cartas
// distintas -> resultados distintos. Corre con el test runner nativo de Node (node --test), sin
// agregar ninguna dependencia — coherente con "sin dependencias externas" del nucleo (doc §1/§8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCard } from "./resolver.js";
import { SLOT_REGISTRY } from "./data/slotRegistry.js";

// Catalogo sintetico minimo: no hace falta imagen real para probar determinismo, el resolver ni
// siquiera las toca (doc §5.1: "no toca imagenes"). 2+ variantes en los slots que nos interesa ver
// variar, para que el PRNG tenga algo entre lo que elegir.
const CATALOG = [
  { id: "torso_a", slot: "torso", rarityMin: "Comun" },
  { id: "torso_b", slot: "torso", rarityMin: "Comun" },
  { id: "torso_c", slot: "torso", rarityMin: "Comun" },
  { id: "head_a", slot: "head", rarityMin: "Comun" },
  { id: "head_b", slot: "head", rarityMin: "Comun" },
  { id: "hips_a", slot: "hips", rarityMin: "Comun" },
  { id: "hips_b", slot: "hips", rarityMin: "Comun" },
  { id: "torso_armor_a", slot: "torso_armor", rarityMin: "Raro" },
];

function pieceMapToObject(pieceMap) {
  return Object.fromEntries([...pieceMap.entries()].sort());
}

function makeCard(id, rareza = "Comun") {
  return { id, rareza, clase: "Guerrero", continente: "America", sexo: "Masculino", overrides: {} };
}

test("misma carta produce siempre el mismo resultado (byte a byte, via JSON)", () => {
  const cardA1 = resolveCard(makeCard("2698831973624"), CATALOG, SLOT_REGISTRY);
  const cardA2 = resolveCard(makeCard("2698831973624"), CATALOG, SLOT_REGISTRY);
  assert.deepEqual(pieceMapToObject(cardA1.pieceMap), pieceMapToObject(cardA2.pieceMap));
  assert.equal(JSON.stringify(pieceMapToObject(cardA1.pieceMap)), JSON.stringify(pieceMapToObject(cardA2.pieceMap)));
});

test("cartas con distinto id no siempre producen el mismo resultado", () => {
  const ids = ["2698831973624", "5253459674420", "6493614729421"];
  const results = ids.map((id) => JSON.stringify(pieceMapToObject(resolveCard(makeCard(id), CATALOG, SLOT_REGISTRY).pieceMap)));
  const distinct = new Set(results);
  assert.ok(distinct.size > 1, "se esperaba que al menos 2 de las 3 cartas difirieran en algun slot");
});

test("overrides fuerza una pieza especifica, saltando la seleccion automatica", () => {
  const card = { ...makeCard("2698831973624"), overrides: { torso: "torso_b" } };
  const { pieceMap } = resolveCard(card, CATALOG, SLOT_REGISTRY);
  assert.equal(pieceMap.get("torso"), "torso_b");
});

test("rarityMin filtra piezas: una carta Comun no puede sacar una pieza Raro", () => {
  const card = makeCard("2698831973624", "Comun");
  const { pieceMap } = resolveCard(card, CATALOG, SLOT_REGISTRY);
  // torso_armor es opcional (no esta en SLOT_REGISTRY como required), asi que puede quedar sin
  // asignar sin generar warning de slot obligatorio — lo que importa es que NUNCA elija la pieza
  // Raro para una carta Comun.
  assert.notEqual(pieceMap.get("torso_armor"), "torso_armor_a");
});

test("slot obligatorio sin candidatos genera warning, no falla silenciosamente", () => {
  const { warnings } = resolveCard(makeCard("2698831973624"), CATALOG, SLOT_REGISTRY);
  // upperarm_far es obligatorio y no tiene ninguna pieza en el catalogo sintetico de este test.
  assert.ok(warnings.some((w) => w.includes("upperarm_far")));
});
