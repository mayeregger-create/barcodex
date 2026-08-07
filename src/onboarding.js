// src/onboarding.js
// Flags de "primera vez" (localStorage) para la experiencia guiada — separados de storage.js
// porque no son datos del jugador (personajes/items escaneados), son solo "ya viste esto".
const KEY_VISITED_COMBAT = "barcodex_visited_combat";
const KEY_SEEN_COMBAT_TUTORIAL = "barcodex_seen_combat_tutorial";
const KEY_SEEN_PARTY_INVITE = "barcodex_seen_party_invite";

export function hasVisitedCombat() {
  return localStorage.getItem(KEY_VISITED_COMBAT) === "1";
}
export function markVisitedCombat() {
  localStorage.setItem(KEY_VISITED_COMBAT, "1");
}

export function hasSeenCombatTutorial() {
  return localStorage.getItem(KEY_SEEN_COMBAT_TUTORIAL) === "1";
}
export function markSeenCombatTutorial() {
  localStorage.setItem(KEY_SEEN_COMBAT_TUTORIAL, "1");
}

export function hasSeenPartyInvite() {
  return localStorage.getItem(KEY_SEEN_PARTY_INVITE) === "1";
}
export function markSeenPartyInvite() {
  localStorage.setItem(KEY_SEEN_PARTY_INVITE, "1");
}
