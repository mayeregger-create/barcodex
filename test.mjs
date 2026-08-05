import { generateCharacter, checkDigit } from "./src/core/character.js";
import { analyzeSquad, relation, wheelModifier } from "./src/core/squad.js";
import { generateItem } from "./src/core/items.js";
import { baseDamage, hpMax, resolveParry, resolveTurnOrder } from "./src/core/combat.js";

const code = "3685957489060";
const ch = generateCharacter(code);
console.log("PERSONAJE:", JSON.stringify(ch, null, 2));

const squad = analyzeSquad(["Europa", "America", "Asia"]);
console.log("\nESCUADRON:", squad);

const dmg = baseDamage(ch.stats.Fuerza, 10);
console.log("\nDAÑO DE EJEMPLO (vs Defensa 10):", dmg);

const item = generateItem("9784038854217");
console.log("\nITEM:", item);

console.log("\nOK -- todos los modulos cargan y corren sin errores");
