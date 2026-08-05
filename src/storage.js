// src/storage.js
// Persistencia simple del jugador (localStorage). No forma parte de src/core:
// el motor de reglas sigue siendo puro, esto es solo la capa de guardado de la app.

const CHARACTERS_KEY = "barcodex_personajes";
const ITEMS_KEY = "barcodex_items";

export function getScannedCharacterCodes() {
  const raw = localStorage.getItem(CHARACTERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function addScannedCharacterCode(code) {
  const codes = getScannedCharacterCodes();
  if (codes.includes(code)) return codes;
  const next = [...codes, code];
  localStorage.setItem(CHARACTERS_KEY, JSON.stringify(next));
  return next;
}

export function getScannedItemCodes() {
  const raw = localStorage.getItem(ITEMS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function addScannedItemCode(code) {
  const codes = getScannedItemCodes();
  if (codes.includes(code)) return codes;
  const next = [...codes, code];
  localStorage.setItem(ITEMS_KEY, JSON.stringify(next));
  return next;
}

export function setScannedCharacterCodes(codes) {
  localStorage.setItem(CHARACTERS_KEY, JSON.stringify(codes));
}

export function setScannedItemCodes(codes) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(codes));
}
