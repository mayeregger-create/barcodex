// src/combat/reportEconomy.mjs
// Mide el ritmo de la economia de Impulso/Escombros/Regente (economy.js + simulateEconomy.js)
// discutida en el chat: cuanto tarda en poblarse el tablero, cuanto Impulso queda sin gastar,
// cuanta duracion de partida agrega frente al baseline sin economia (linea de tiro, mazo entero
// desplegado de arranque), y si un tope de curva de mazo haria falta. Uso:
//   node src/combat/reportEconomy.mjs [N]
import { generateCard } from "../cardgen/card.js";
import { simulateMatch } from "./simulate.js";
import { simulateMatchWithEconomy } from "./simulateEconomy.js";

const N = Number(process.argv[2]) || 1500;
const DECK_SIZE = 5;
const MAX_ROUNDS = 60;
const CURVE_CAP_CANDIDATE = 22; // tope de mazo a evaluar (suma de Coste de las 5 cartas)
// nucleoShieldRounds usa el default adoptado de simulateMatchWithEconomy (3) — no se pasa explicito.

function randomCode(seed) {
  let s = seed;
  let out = "";
  for (let i = 0; i < 13; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out += s % 10;
  }
  return out;
}

/** Misma regla de §14.2 (min 1 Pierce + 1 Blunt) que los reportes anteriores — sin tope de curva
 * todavia, para poder MEDIR que tan seguido un mazo asi ya cae bajo o sobre el candidato. */
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

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
}

const BUCKETS = [
  [1, 10],
  [11, 20],
  [21, 30],
  [31, 40],
  [41, 50],
  [51, 60],
];

function bucketize(roundsArr) {
  const counts = BUCKETS.map(() => 0);
  for (const r of roundsArr) {
    const idx = BUCKETS.findIndex(([lo, hi]) => r >= lo && r <= hi);
    counts[idx === -1 ? counts.length - 1 : idx] += 1;
  }
  return counts;
}

// --- baseline sin economia (mazo entero desplegado de arranque, linea de tiro) ---
const baselineRounds = [];
const baselineWinners = { A: 0, B: 0, draw: 0 };
for (let i = 0; i < N; i++) {
  const result = simulateMatch(compliantDeck(i * 104729 + 1), compliantDeck(i * 224737 + 2), { maxRounds: MAX_ROUNDS, lineOfSight: true });
  baselineRounds.push(result.rounds);
  baselineWinners[result.winner] += 1;
}

// --- con economia (Impulso/Escombros/Regente) ---
const ecoRounds = [];
const ecoWinners = { A: 0, B: 0, draw: 0 };
const secondUnitRounds = { A: [], B: [] };
const boardFullRounds = { A: [], B: [] };
const handEmptyRounds = { A: [], B: [] };
const impulsoLeftoverPerRound = { A: [], B: [] };
const escombrosFinal = { A: [], B: [] };
const deckTotalCosts = [];
let overCapCount = 0;

for (let i = 0; i < N; i++) {
  const deckA = compliantDeck(i * 104729 + 1);
  const deckB = compliantDeck(i * 224737 + 2);
  for (const d of [deckA, deckB]) {
    const total = d.reduce((s, c) => s + c.cost, 0);
    deckTotalCosts.push(total);
    if (total > CURVE_CAP_CANDIDATE) overCapCount += 1;
  }

  const result = simulateMatchWithEconomy(deckA, deckB, { maxRounds: MAX_ROUNDS });
  ecoRounds.push(result.rounds);
  ecoWinners[result.winner] += 1;

  for (const side of ["A", "B"]) {
    if (result.stats.secondUnitRound[side] !== null) secondUnitRounds[side].push(result.stats.secondUnitRound[side]);
    if (result.stats.boardFullRound[side] !== null) boardFullRounds[side].push(result.stats.boardFullRound[side]);
    if (result.stats.handEmptyRound[side] !== null) handEmptyRounds[side].push(result.stats.handEmptyRound[side]);
    impulsoLeftoverPerRound[side].push(result.stats.impulsoLeftoverSum[side] / result.rounds);
    escombrosFinal[side].push(result.escombros[side]);
  }
}

console.log(`\n=== Economia de Impulso/Escombros/Regente — ${N} partidas, tope ${MAX_ROUNDS} rondas, mazos de ${DECK_SIZE} ===\n`);

console.log("--- Duracion: baseline (mazo entero de arranque) vs. con economia ---");
console.log(`${"rango".padEnd(10)} ${"baseline".padEnd(12)} ${"con economia".padEnd(14)}`);
const baseCounts = bucketize(baselineRounds);
const ecoCounts = bucketize(ecoRounds);
for (let i = 0; i < BUCKETS.length; i++) {
  const label = i === BUCKETS.length - 1 ? `${BUCKETS[i][0]}+` : `${BUCKETS[i][0]}-${BUCKETS[i][1]}`;
  console.log(`${label.padEnd(10)} ${((baseCounts[i] / N) * 100).toFixed(1).padEnd(11)}% ${((ecoCounts[i] / N) * 100).toFixed(1)}%`);
}
console.log(`\nRonda media: baseline ${mean(baselineRounds).toFixed(1)}, con economia ${mean(ecoRounds).toFixed(1)}`);
console.log(`Empates (${MAX_ROUNDS}+ rondas sin resolver): baseline ${baselineWinners.draw}/${N} (${((baselineWinners.draw / N) * 100).toFixed(1)}%), con economia ${ecoWinners.draw}/${N} (${((ecoWinners.draw / N) * 100).toFixed(1)}%)`);

console.log("\n--- Ritmo de despliegue (con economia) ---");
console.log(`Ronda en que entra la 2da unidad (la 1ra es el Regente, ronda 1 siempre) — media: A ${mean(secondUnitRounds.A).toFixed(2)}, B ${mean(secondUnitRounds.B).toFixed(2)}`);
console.log(`Ronda en que el tablero queda con las 3 posiciones llenas — media: A ${mean(boardFullRounds.A).toFixed(2)}, B ${mean(boardFullRounds.B).toFixed(2)} (nunca llego en ${N - boardFullRounds.A.length + N - boardFullRounds.B.length} de ${2 * N} lados)`);
console.log(`Ronda en que la mano queda vacia (mazo entero ya comprometido) — media: A ${mean(handEmptyRounds.A).toFixed(2)}, B ${mean(handEmptyRounds.B).toFixed(2)} (nunca vacio en ${N - handEmptyRounds.A.length + N - handEmptyRounds.B.length} de ${2 * N} lados)`);

console.log("\n--- Eficiencia de curva ---");
console.log(`Impulso promedio sin gastar al cierre de cada ronda (0 = curva perfecta, cerca de 8 = casi nunca hay nada que pagar): A ${mean(impulsoLeftoverPerRound.A).toFixed(2)}, B ${mean(impulsoLeftoverPerRound.B).toFixed(2)}`);

console.log("\n--- Escombros acumulados al cierre de la partida ---");
console.log(`Media: A ${mean(escombrosFinal.A).toFixed(2)}, B ${mean(escombrosFinal.B).toFixed(2)}  ·  max visto: A ${Math.max(...escombrosFinal.A)}, B ${Math.max(...escombrosFinal.B)}`);

console.log("\n--- ¿Hace falta un tope de curva de mazo? ---");
console.log(`Suma de Coste por mazo (mazos de ${DECK_SIZE} cartas, con cobertura §14.2) — media ${mean(deckTotalCosts).toFixed(1)}, min ${Math.min(...deckTotalCosts)}, max ${Math.max(...deckTotalCosts)}`);
console.log(`Mazos que superan ${CURVE_CAP_CANDIDATE} de Coste total: ${overCapCount}/${deckTotalCosts.length} (${((overCapCount / deckTotalCosts.length) * 100).toFixed(1)}%)`);
console.log("");
