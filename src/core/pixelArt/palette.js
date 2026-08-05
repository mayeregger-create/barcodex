// src/core/pixelArt/palette.js
// Paleta de colores para el sistema de sprites pixel-art (ver drawSprite.js). Reemplaza a los
// prompts de imagePrompt.js/itemImagePrompt.js: en vez de describir el color en texto para una
// IA, acá se define directo como hex, para pintar las grillas de characterSprites.js/itemSprites.js.

// Continente -> paleta de la vestimenta (no del tono de piel: la idea es "colores de facción",
// igual que el motivo de color+patron que ya usaba el prompt viejo, sin tocar el tono de piel).
export const CONTINENT_COLORS = {
  America: { primary: "#d9642f", secondary: "#f2b134" },
  Europa: { primary: "#5b4b8a", secondary: "#b9c4d6" },
  Asia: { primary: "#1f7a6c", secondary: "#d4af37" },
  Africa: { primary: "#c97b3d", secondary: "#7a4526" },
  Oceania: { primary: "#219e94", secondary: "#ff8a7a" },
};

// Rareza -> slug de clase CSS (ver .rareza-frame--* en index.css). Reusa la misma progresion de
// material que MATERIAL_COLORS (bronce/plata/oro), asi "mejora de material por rareza" es
// consistente en toda la app — el mismo criterio que despues va a decidir el material de
// armas/armaduras por rareza.
export const RAREZA_TIER = {
  Comun: "comun",
  "Poco comun": "poco-comun",
  Raro: "raro",
  Epico: "epico",
};

// Stat dominante -> color de acento (arma/prop del personaje, brillo de items).
export const STAT_ACCENT = {
  Fuerza: "#d9483a",
  Velocidad: "#3ac6c6",
  Defensa: "#d9b23c",
  Energia: "#9b59d9",
  Suerte: "#e07bb0",
};

export const MATERIAL_COLORS = {
  Piedra: "#8d8d84",
  Acero: "#9aa4ad",
  Hielo: "#a8dbe8",
  Madera: "#8a5a34",
  Cristal: "#bfe6e0",
  Hueso: "#e8ddc2",
  Bronce: "#b08d57",
  Obsidiana: "#332b3d",
  Plata: "#c9ced4",
  Oro: "#e6c34d",
};

export const SKIN_TONE = "#e8b98c";
export const HAIR_TONE = "#3a2a1e";
export const OUTLINE_COLOR = "#1a1610";
export const HIGHLIGHT_COLOR = "#fff8ec";
// Pupila del ojo: oscura y chica, NO el highlight brillante (ver drawSprite bevel) — con 'e'
// (highlight) los ojos quedaban como un cuadrado blanco liso ("anteojos"), no una mirada real.
export const EYE_COLOR = "#2a1c14";
// Guarda/empuñadura de armas — metal neutro oscuro, para que la hoja (color de stat) se lea
// separada del puño (siempre este tono, sin importar clase/stat).
export const METAL_TONE = "#6b6f76";

/** Oscurece un color hex un porcentaje (0-100), para dar sombra/profundidad sin pedir otro asset. */
export function shade(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
