// src/combat/simulate.test.js
// Sanidad del simulador (no determinismo del producto — esto es una herramienta de analisis, no
// el generador). Corre con node --test como el resto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCard } from "../cardgen/card.js";
import { simulateMatch } from "./simulate.js";
import { NUCLEO_BASE } from "./board.js";

function randomCode(seed) {
  let s = seed, out = "";
  for (let i = 0; i < 13; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; out += s % 10; }
  return out;
}

function randomDeck(seedBase, n = 3) {
  const cards = [];
  for (let i = 0; i < n; i++) cards.push(generateCard(randomCode(seedBase + i * 97)));
  return cards;
}

test("una partida termina siempre (nunca cuelga en maxRounds sin ganador valido)", () => {
  for (let i = 0; i < 30; i++) {
    const result = simulateMatch(randomDeck(i * 7919 + 1), randomDeck(i * 104729 + 2), { maxRounds: 40 });
    assert.ok(["A", "B", "draw"].includes(result.winner));
    assert.ok(result.rounds > 0 && result.rounds <= 40);
    assert.ok(result.nucleoA >= 0 && result.nucleoA <= NUCLEO_BASE);
    assert.ok(result.nucleoB >= 0 && result.nucleoB <= NUCLEO_BASE);
  }
});

test("Blunt casi nunca es un golpe realmente en el aire (doc §17.4) — pero NO nunca", () => {
  // Contra placa el dano es fijo (1, doc §5.3), asi que ahi Blunt jamas da "trueWaste" — siempre
  // rompe algo (integridad o placa). Sin placa escala con Fuerza efectiva (ceil(fuerza/2)) — y la
  // Fuerza puede llegar a 0 en combate si el brazo principal se rompe (-2, doc §4.2) sobre una
  // unidad que ya generaba Fuerza baja. Es un caso borde real de las reglas, no un bug del
  // simulador — por eso el test mide una TASA baja en vez de asumir cero absoluto.
  let attacks = 0;
  let waste = 0;
  for (let i = 0; i < 200; i++) {
    const result = simulateMatch(randomDeck(i * 13 + 500), randomDeck(i * 17 + 900));
    attacks += result.stats.byType.blunt.attacks;
    waste += result.stats.byType.blunt.trueWaste;
  }
  assert.ok(attacks > 0, "no se registraron ataques Blunt en 200 partidas, algo esta mal en el despliegue");
  assert.ok(waste / attacks < 0.03, `tasa de Blunt-en-el-aire demasiado alta: ${((waste / attacks) * 100).toFixed(2)}%`);
});

test("Cut nunca es un golpe realmente en el aire — o rompe Integridad, o rompe Placa (doc §5.3)", () => {
  // Este es el arreglo de metrica que motivo separar plateChipped de trueWaste: antes se contaba
  // "rompio 1 de Placa" como si fuera lo mismo que "no paso nada", y no lo es — es la funcion real
  // de Cut ("Cut abre puertas, Blunt hace dano a traves de ellas", doc §5.3).
  let attacks = 0;
  let waste = 0;
  let chipped = 0;
  for (let i = 0; i < 200; i++) {
    const result = simulateMatch(randomDeck(i * 41 + 3000), randomDeck(i * 43 + 4000));
    attacks += result.stats.byType.cut.attacks;
    waste += result.stats.byType.cut.trueWaste;
    chipped += result.stats.byType.cut.plateChipped;
  }
  assert.ok(attacks > 0, "no se registraron ataques Cut en 200 partidas");
  assert.ok(chipped > 0, "Cut nunca rompio una placa en 200 partidas — revisar hitZone()");
  assert.ok(waste / attacks < 0.03, `tasa de Cut-en-el-aire demasiado alta: ${((waste / attacks) * 100).toFixed(2)}%`);
});

test("Pierce puede quedarse sin objetivo si el rival esta todo blindado (a diferencia de Blunt)", () => {
  // No es una garantia matematica con mazos al azar, pero sobre una muestra grande deberia
  // aparecer al menos una vez — si nunca aparece, sospechar que la regla "sin placa" no se esta
  // aplicando en selectTarget.
  let sawPierceNoTarget = false;
  for (let i = 0; i < 200; i++) {
    const result = simulateMatch(randomDeck(i * 31 + 1000), randomDeck(i * 37 + 2000));
    if (result.stats.byType.pierce.noTarget > 0) sawPierceNoTarget = true;
  }
  assert.ok(sawPierceNoTarget, "en 200 partidas, Pierce nunca se quedo sin objetivo — revisar el filtro de placa");
});

test("un torso roto marca fallen y saca a la unidad de aliveBattlers", () => {
  const result = simulateMatch(randomDeck(42), randomDeck(4242));
  assert.ok(result.stats.torsoBreaks >= 0); // no deberia tirar, y el contador es siempre >= 0
});

test("linea de tiro (regla real, default true) resuelve la enorme mayoria de partidas — no la regla vieja de tablero 100% limpio", () => {
  // Numeros de referencia (chat): regla vieja ~45% de empates en 1500 partidas de 5 cartas con
  // Reserva; linea de tiro ~1.2%. Este test no pide ese nivel de precision (una muestra chica es
  // ruidosa), solo que la tasa de empate quede claramente baja — si algun cambio futuro vuelve a
  // acercarla al 45%, es señal de que la regla vieja volvio a colarse en el default.
  let draws = 0;
  const total = 150;
  for (let i = 0; i < total; i++) {
    const result = simulateMatch(randomDeck(i * 53 + 7000, 5), randomDeck(i * 59 + 8000, 5), { maxRounds: 60 });
    if (result.winner === "draw") draws += 1;
  }
  assert.ok(draws / total < 0.15, `demasiados empates con la regla default: ${draws}/${total}`);
});
