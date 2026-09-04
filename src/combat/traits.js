// src/combat/traits.js
// Helper compartido para consultar si una carta/battler tiene un rasgo activo — el primario, o
// (si es Anomalo) el secundario. El resto del motor de combate no necesita saber que un rasgo
// puede venir de dos campos distintos ni tocar `identity` directamente.
export function cardHasTrait(card, traitId) {
  return card.identity.trait === traitId || card.identity.secondTrait === traitId;
}

export function hasTrait(battler, traitId) {
  return cardHasTrait(battler.card, traitId);
}

/** Colosal: "no actua la ronda en que se despliega" — `battler.justDeployed` se apaga en el
 * primer `resetRoundFlags` que le toca (board.js), asi que esto es true solo durante la ronda en
 * que la carta entro al tablero. Compartido entre simulateEconomy.js y BoardPrototype.jsx (los dos
 * orquestadores que modelan despliegue ronda a ronda) para no repetir el mismo chequeo dos veces. */
export function isColosalGrounded(battler) {
  return hasTrait(battler, "colosal") && battler.justDeployed;
}
