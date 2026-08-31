// src/combat/report.mjs
// Corre un lote grande de partidas simuladas y responde con numeros reales los pendientes del
// doc "Sistema de juego" §17 ("A verificar en partida"): duracion del torso, dominancia de
// Blunt, frecuencia de Colapso vs. muerte por torso. Uso: node src/combat/report.mjs [N]
import { generateCard } from "../cardgen/card.js";
import { simulateMatch } from "./simulate.js";

const N = Number(process.argv[2]) || 1000;
const DECK_SIZE = 5; // 3 en tablero + 2 de Reserva — le da sentido real al backfill

function randomCode(seed) {
  let s = seed;
  let out = "";
  for (let i = 0; i < 13; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out += s % 10;
  }
  return out;
}

/** Mazo que cumple la regla de construccion del §14.2 (al menos 1 unidad con Blunt y 1 con
 * Pierce) — antes generaba mazos 100% al azar, lo que podia dejar al rival sin nadie en las
 * posiciones que Pierce necesita puramente por casualidad de generacion, no por una estrategia de
 * formacion real. Sigue siendo determinista dado el seed (mismo seed = mismo mazo). */
function compliantDeck(seedBase, n = DECK_SIZE) {
  const cards = [];
  let i = 0;
  let hasPierce = false;
  let hasBlunt = false;
  while (cards.length < n || !hasPierce || !hasBlunt) {
    const card = generateCard(randomCode(seedBase + i * 97));
    i += 1;
    if (cards.length < n) {
      cards.push(card);
    } else if (!hasPierce && card.combat.damageTypeActive === "pierce") {
      cards[cards.length - 1] = card; // swap el ultimo si hace falta cubrir el requisito
    } else if (!hasBlunt && card.combat.damageTypeActive === "blunt") {
      cards[cards.length - 1] = card;
    }
    hasPierce = hasPierce || cards.some((c) => c.combat.damageTypeActive === "pierce");
    hasBlunt = hasBlunt || cards.some((c) => c.combat.damageTypeActive === "blunt");
    if (i > 200) break; // salvavidas, no deberia hacer falta
  }
  return cards;
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
}

const winners = { A: 0, B: 0, draw: 0 };
const rounds = [];
const torsoBreaksPerMatch = [];
const collapsesPerMatch = [];
const byType = {
  pierce: { attacks: 0, trueWaste: 0, plateChipped: 0, noTarget: 0 },
  cut: { attacks: 0, trueWaste: 0, plateChipped: 0, noTarget: 0 },
  blunt: { attacks: 0, trueWaste: 0, plateChipped: 0, noTarget: 0 },
  magic: { attacks: 0, trueWaste: 0, plateChipped: 0, noTarget: 0 },
};
const hitsToBreakByZone = { head: [], torso: [], armMain: [], armOff: [], legs: [] };

for (let i = 0; i < N; i++) {
  const result = simulateMatch(compliantDeck(i * 104729 + 1), compliantDeck(i * 224737 + 2));
  winners[result.winner] += 1;
  rounds.push(result.rounds);
  torsoBreaksPerMatch.push(result.stats.torsoBreaks);
  collapsesPerMatch.push(result.stats.collapses);
  for (const type of Object.keys(byType)) {
    byType[type].attacks += result.stats.byType[type].attacks;
    byType[type].trueWaste += result.stats.byType[type].trueWaste;
    byType[type].plateChipped += result.stats.byType[type].plateChipped;
    byType[type].noTarget += result.stats.byType[type].noTarget;
  }
  for (const zone of Object.keys(hitsToBreakByZone)) {
    hitsToBreakByZone[zone].push(...result.stats.hitsToBreakByZone[zone]);
  }
}

console.log(`\n=== Reporte de balance — ${N} partidas simuladas (mazos de ${DECK_SIZE}, con cobertura §14.2, con Reserva) ===\n`);

console.log("--- Resultado general ---");
console.log(`A: ${winners.A} (${((winners.A / N) * 100).toFixed(1)}%)  B: ${winners.B} (${((winners.B / N) * 100).toFixed(1)}%)  Empate: ${winners.draw}`);
console.log(`Rondas por partida — media ${mean(rounds).toFixed(1)}, min ${Math.min(...rounds)}, max ${Math.max(...rounds)}`);

console.log("\n--- §17.3: Duracion del torso (golpes reales hasta romper cada zona) ---");
for (const zone of Object.keys(hitsToBreakByZone)) {
  const arr = hitsToBreakByZone[zone];
  if (arr.length === 0) {
    console.log(`  ${zone}: nunca se rompio en la muestra`);
    continue;
  }
  console.log(`  ${zone}: media ${mean(arr).toFixed(2)} golpes, min ${Math.min(...arr)}, max ${Math.max(...arr)}, n=${arr.length}`);
}

console.log("\n--- §17.4: Dominancia de Blunt (ahora con plateChipped separado de trueWaste) ---");
console.log("  tipo     ataques  trueWaste  plateChipped  sin-objetivo");
for (const type of Object.keys(byType)) {
  const t = byType[type];
  const wasteRate = t.attacks ? ((t.trueWaste / t.attacks) * 100).toFixed(2) : "—";
  const chipRate = t.attacks ? ((t.plateChipped / t.attacks) * 100).toFixed(2) : "—";
  const noTargetRate = (t.attacks + t.noTarget) ? ((t.noTarget / (t.attacks + t.noTarget)) * 100).toFixed(2) : "—";
  console.log(`  ${type.padEnd(7)}  ${String(t.attacks).padEnd(7)}  ${wasteRate}%${" ".repeat(Math.max(0, 6 - String(wasteRate).length))}    ${chipRate}%${" ".repeat(Math.max(0, 9 - String(chipRate).length))}    ${noTargetRate}%`);
}

console.log("\n--- §17.5: Colapso vs. muerte por torso ---");
const totalTorso = torsoBreaksPerMatch.reduce((a, b) => a + b, 0);
const totalCollapse = collapsesPerMatch.reduce((a, b) => a + b, 0);
console.log(`  Torso roto (muerte): ${totalTorso} en total, media ${mean(torsoBreaksPerMatch).toFixed(2)}/partida`);
console.log(`  Colapso (brazos/piernas): ${totalCollapse} en total, media ${mean(collapsesPerMatch).toFixed(2)}/partida`);
console.log(`  Proporcion Colapso:Torso = ${totalTorso ? (totalCollapse / totalTorso).toFixed(2) : "—"}:1`);
console.log("");
