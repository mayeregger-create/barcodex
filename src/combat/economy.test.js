// src/combat/economy.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCard } from "../cardgen/card.js";
import {
  gainImpulso,
  escombrosFromLoss,
  pickRegente,
  nucleoBonusFromRegente,
  commitFromHand,
  IMPULSO_CAP,
  IMPULSO_START,
} from "./economy.js";
import { simulateMatchWithEconomy } from "./simulateEconomy.js";

function randomCode(seed) {
  let s = seed;
  let out = "";
  for (let i = 0; i < 13; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out += s % 10;
  }
  return out;
}

function deck(seedBase, n = 5) {
  const cards = [];
  for (let i = 0; i < n; i++) cards.push(generateCard(randomCode(seedBase + i * 97)));
  return cards;
}

test("gainImpulso: arranca en 2 tras la ronda 1 y nunca supera el tope", () => {
  let impulso = IMPULSO_START;
  impulso = gainImpulso(impulso);
  assert.equal(impulso, 2);
  for (let i = 0; i < 20; i++) impulso = gainImpulso(impulso);
  assert.equal(impulso, IMPULSO_CAP);
});

test("gainImpulso: banking respeta el tope (no se resetea, pero tampoco se dispara)", () => {
  // si no se gasta nada, el banco sube 1 por ronda igual que el tope — nunca se adelanta a el
  let impulso = IMPULSO_START;
  for (let round = 1; round <= 10; round++) {
    impulso = gainImpulso(impulso);
    assert.ok(impulso <= IMPULSO_CAP);
  }
});

test("escombrosFromLoss: proporcional al Coste, minimo 1", () => {
  assert.equal(escombrosFromLoss(1), 1);
  assert.equal(escombrosFromLoss(4), 1);
  assert.equal(escombrosFromLoss(6), 2);
  assert.equal(escombrosFromLoss(8), 3);
});

test("pickRegente: elige la carta mas cara y la saca de la mano", () => {
  const d = deck(1);
  const { regente, hand } = pickRegente(d);
  assert.equal(hand.length, d.length - 1);
  assert.ok(d.every((c) => c.cost <= regente.cost));
  assert.ok(!hand.includes(regente));
});

test("nucleoBonusFromRegente: no negativo, escala con Integridad de torso", () => {
  const d = deck(2);
  const { regente } = pickRegente(d);
  const bonus = nucleoBonusFromRegente(regente);
  assert.ok(bonus >= 0);
  assert.equal(bonus, Math.round(regente.zones.torso.integrity / 4));
});

test("commitFromHand: nunca gasta mas Impulso del disponible", () => {
  const d = deck(3);
  const { hand } = pickRegente(d);
  for (let impulso = 0; impulso <= 8; impulso++) {
    const res = commitFromHand(hand, impulso);
    assert.ok(res.impulsoSpent <= impulso);
    assert.equal(res.impulsoSpent, impulso - res.impulsoLeft);
    assert.equal(res.committed.length + res.hand.length, hand.length);
  }
});

test("commitFromHand: es determinista para la misma mano e impulso", () => {
  const d = deck(4);
  const { hand } = pickRegente(d);
  const a = commitFromHand(hand, 5);
  const b = commitFromHand(hand, 5);
  assert.deepEqual(a.committed.map((c) => c.code), b.committed.map((c) => c.code));
});

test("simulateMatchWithEconomy: corre de punta a punta y resuelve (o corta en el tope de rondas)", () => {
  const result = simulateMatchWithEconomy(deck(10), deck(20), { maxRounds: 60 });
  assert.ok(["A", "B", "draw"].includes(result.winner));
  assert.ok(result.rounds >= 1 && result.rounds <= 60);
  assert.ok(result.nucleoA >= 0 && result.nucleoB >= 0);
  assert.ok(result.escombros.A >= 0 && result.escombros.B >= 0);
});

test("simulateMatchWithEconomy: nucleoShieldRounds blinda al Nucleo — ningun hit_nucleo dentro de la ventana", () => {
  // barremos varios seeds: con el escudo activo, ningun "hit_nucleo" real puede loguearse en las
  // primeras N rondas — como mucho "nucleo_shielded" (el golpe se pierde, no llega a aplicarse).
  for (let seed = 0; seed < 15; seed++) {
    const result = simulateMatchWithEconomy(deck(seed * 41 + 3), deck(seed * 43 + 5), {
      maxRounds: 10,
      nucleoShieldRounds: 3,
    });
    const nucleoHitsDuringShield = result.log.filter((e) => e.round <= 3 && e.kind === "hit_nucleo");
    assert.equal(nucleoHitsDuringShield.length, 0, `seed ${seed}: no deberia haber hit_nucleo en rondas 1-3`);
  }
});

test("simulateMatchWithEconomy: con nucleoShieldRounds=0 (escudo desactivado a proposito), hit_nucleo puede ocurrir en rondas tempranas", () => {
  // control: confirma que la ausencia de nucleoHitsDuringShield arriba es obra del escudo, no
  // casualidad de que el Nucleo nunca sea alcanzable tan temprano.
  let sawEarlyHit = false;
  for (let seed = 0; seed < 30 && !sawEarlyHit; seed++) {
    const result = simulateMatchWithEconomy(deck(seed * 41 + 3), deck(seed * 43 + 5), { maxRounds: 10, nucleoShieldRounds: 0 });
    if (result.log.some((e) => e.round <= 3 && e.kind === "hit_nucleo")) sawEarlyHit = true;
  }
  assert.ok(sawEarlyHit, "deberia existir al menos un mazo de prueba con hit_nucleo temprano sin escudo");
});

test("simulateMatchWithEconomy: el escudo esta adoptado como default (3 rondas) sin pasar opciones", () => {
  for (let seed = 0; seed < 15; seed++) {
    const result = simulateMatchWithEconomy(deck(seed * 41 + 3), deck(seed * 43 + 5), { maxRounds: 10 });
    const nucleoHitsDuringShield = result.log.filter((e) => e.round <= 3 && e.kind === "hit_nucleo");
    assert.equal(nucleoHitsDuringShield.length, 0, `seed ${seed}: el default deberia blindar al Nucleo en rondas 1-3`);
  }
});

test("simulateMatchWithEconomy: el Regente de cada lado esta en el tablero desde la ronda 1", () => {
  // corremos solo hasta que loguee algo de la ronda 1 — si el Regente no se desplegara gratis,
  // ninguna de las dos unidades podria actuar en la ronda 1 salvo que el Impulso (2) ya alcance
  // para pagar una carta de mano, lo cual no siempre pasa (mazos con costes altos) — el log de la
  // ronda 1 debe tener AL MENOS una entrada por bando en la enorme mayoria de los mazos.
  let sawA = false;
  let sawB = false;
  for (let seed = 0; seed < 30 && !(sawA && sawB); seed++) {
    const result = simulateMatchWithEconomy(deck(seed * 31 + 1), deck(seed * 37 + 2), { maxRounds: 1 });
    for (const entry of result.log) {
      if (entry.round === 1 && entry.side === "A") sawA = true;
      if (entry.round === 1 && entry.side === "B") sawB = true;
    }
  }
  assert.ok(sawA && sawB, "el Regente deberia actuar en la ronda 1 en casi todos los mazos de prueba");
});
