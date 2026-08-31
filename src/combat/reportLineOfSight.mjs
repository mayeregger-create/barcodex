// src/combat/reportLineOfSight.mjs
// Compara la regla vieja (Nucleo expuesto solo con el tablero 100% limpio) contra la propuesta
// de "linea de tiro" del chat (expuesto por tipo si SU Alcance especifico esta vacio), con foco
// en la distribucion de cuanto tardan las partidas en resolverse. Uso: node src/combat/reportLineOfSight.mjs [N]
import { generateCard } from "../cardgen/card.js";
import { simulateMatch } from "./simulate.js";

const N = Number(process.argv[2]) || 1500;
const DECK_SIZE = 5;
const MAX_ROUNDS = 60; // mas alto que el reporte anterior, para no confundir "empate real" con "techo corto"

function randomCode(seed) {
  let s = seed;
  let out = "";
  for (let i = 0; i < 13; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out += s % 10;
  }
  return out;
}

function compliantDeck(seedBase, n = DECK_SIZE) {
  const cards = [];
  let i = 0;
  let hasPierce = false;
  let hasBlunt = false;
  while (cards.length < n || !hasPierce || !hasBlunt) {
    const card = generateCard(randomCode(seedBase + i * 97));
    i += 1;
    if (cards.length < n) cards.push(card);
    else if (!hasPierce && card.combat.damageTypeActive === "pierce") cards[cards.length - 1] = card;
    else if (!hasBlunt && card.combat.damageTypeActive === "blunt") cards[cards.length - 1] = card;
    hasPierce = hasPierce || cards.some((c) => c.combat.damageTypeActive === "pierce");
    hasBlunt = hasBlunt || cards.some((c) => c.combat.damageTypeActive === "blunt");
    if (i > 200) break;
  }
  return cards;
}

const BUCKETS = [
  [1, 10],
  [11, 20],
  [21, 30],
  [31, 40],
  [41, 50],
  [51, 60],
];

function bucketLabel([lo, hi]) {
  return `${lo}-${hi}`;
}

function runBatch(lineOfSight) {
  const bucketCounts = BUCKETS.map(() => 0);
  let draws = 0;
  let decisive = 0;
  const decisiveRounds = [];

  for (let i = 0; i < N; i++) {
    const result = simulateMatch(compliantDeck(i * 104729 + 1), compliantDeck(i * 224737 + 2), {
      maxRounds: MAX_ROUNDS,
      lineOfSight,
    });
    if (result.winner === "draw") {
      draws += 1;
    } else {
      decisive += 1;
      decisiveRounds.push(result.rounds);
    }
    const idx = BUCKETS.findIndex(([lo, hi]) => result.rounds >= lo && result.rounds <= hi);
    if (idx !== -1) bucketCounts[idx] += 1;
    else bucketCounts[bucketCounts.length - 1] += 1; // >60 cae en el ultimo balde (incluye los empates)
  }

  const mean = decisiveRounds.length ? decisiveRounds.reduce((a, b) => a + b, 0) / decisiveRounds.length : NaN;
  return { bucketCounts, draws, decisive, meanDecisiveRounds: mean };
}

console.log(`\n=== Regla vieja vs. "linea de tiro" — ${N} partidas cada una, tope ${MAX_ROUNDS} rondas ===\n`);

const oldRule = runBatch(false);
const newRule = runBatch(true);

console.log("--- Distribucion de duracion (rondas hasta que alguien gana) ---");
console.log(`${"rango".padEnd(10)} ${"vieja".padEnd(12)} ${"linea de tiro".padEnd(14)}`);
for (let i = 0; i < BUCKETS.length; i++) {
  const label = i === BUCKETS.length - 1 ? `${BUCKETS[i][0]}+` : bucketLabel(BUCKETS[i]);
  const oldPct = ((oldRule.bucketCounts[i] / N) * 100).toFixed(1);
  const newPct = ((newRule.bucketCounts[i] / N) * 100).toFixed(1);
  console.log(`${label.padEnd(10)} ${(oldPct + "%").padEnd(12)} ${(newPct + "%").padEnd(14)}`);
}

console.log("\n--- Resumen ---");
console.log(`Empates (nunca resuelve en ${MAX_ROUNDS} rondas):`);
console.log(`  Regla vieja:     ${oldRule.draws}/${N} (${((oldRule.draws / N) * 100).toFixed(1)}%)`);
console.log(`  Linea de tiro:   ${newRule.draws}/${N} (${((newRule.draws / N) * 100).toFixed(1)}%)`);
console.log(`\nRonda media de las partidas que SI se resuelven:`);
console.log(`  Regla vieja:     ${oldRule.meanDecisiveRounds.toFixed(1)}`);
console.log(`  Linea de tiro:   ${newRule.meanDecisiveRounds.toFixed(1)}`);
console.log("");
