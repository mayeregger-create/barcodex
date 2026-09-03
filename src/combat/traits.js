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
