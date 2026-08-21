// src/titiritero/data/testPieces.js
// Piezas de prueba generadas programaticamente (doc, entregable #8 de la Tarea 1): rectangulos de
// color con el pivote marcado, cubriendo todos los slots obligatorios + un par de opcionales para
// probar que las capas por encima (armadura sobre torso, etc.) funcionan. El pivote va SIEMPRE al
// centro del rectangulo — simplificacion deliberada para piezas de prueba (no hay anatomia real
// que respetar todavia); cuando entre arte real cada pieza define su propio pivote segun donde
// este el remache de verdad.
//
// Se generan como SVG en texto (data:image/svg+xml,...), NO dibujando en un <canvas> y llamando
// toDataURL() — esa era la version original, y es justo lo que muchas extensiones de privacidad
// de Chrome (proteccion anti-fingerprinting, comun en uBlock Origin y otras) interceptan,
// devolviendo un canvas en blanco sin ningun error visible. Un string de SVG no toca canvas para
// nada en esta etapa (el renderer si usa canvas para DIBUJAR la imagen ya cargada, eso es
// inevitable y no lo bloquea ninguna extension real) — ver chat.
const OUTLINE = "#1a1610";
const PIVOT_MARK = "#ffffff";

function makeRectPiece({ id, slot, color, width, height, rarityMin = "Comun", tags = [], excludes = [] }) {
  const cx = width / 2;
  const cy = height / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" fill="${color}" stroke="${OUTLINE}" stroke-width="3"/>` +
    `<line x1="${cx - 8}" y1="${cy}" x2="${cx + 8}" y2="${cy}" stroke="${PIVOT_MARK}" stroke-width="2"/>` +
    `<line x1="${cx}" y1="${cy - 8}" x2="${cx}" y2="${cy + 8}" stroke="${PIVOT_MARK}" stroke-width="2"/>` +
    `</svg>`;

  return {
    id,
    slot,
    image: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    pivot: { x: cx, y: cy },
    size: { width, height },
    tintable: false,
    tags,
    rarityMin,
    excludes,
  };
}

// slot -> [{ suffix, color, w, h }] — 1 variante para la mayoria, 2 para unos pocos slots clave
// (torso/head/hips/thighs) para que el Resolver realmente tenga algo entre lo que elegir y las
// cartas se vean distintas entre si (si solo hay 1 candidato por slot, el PRNG no tiene nada que
// hacer). Tamaños ballpark acordes a las longitudes de hueso de humanoidRig.js.
const SLOT_VARIANTS = {
  head: [
    { suffix: "a", color: "#e8b98c", w: 110, h: 130 },
    { suffix: "b", color: "#d9a876", w: 110, h: 130 },
  ],
  torso: [
    { suffix: "a", color: "#5b4b8a", w: 210, h: 280 },
    { suffix: "b", color: "#1f7a6c", w: 210, h: 280 },
  ],
  torso_armor: [{ suffix: "a", color: "#9aa4ad", w: 230, h: 260, rarityMin: "Raro" }],
  hips: [
    { suffix: "a", color: "#4a3a5c", w: 170, h: 110 },
    { suffix: "b", color: "#3d2f4a", w: 170, h: 110 },
  ],
  abdomen: [{ suffix: "a", color: "#5b4b8a", w: 150, h: 90 }],
  upperarm_far: [{ suffix: "a", color: "#d9642f", w: 80, h: 180 }],
  forearm_far: [{ suffix: "a", color: "#c95a2a", w: 70, h: 170 }],
  hand_far: [{ suffix: "a", color: "#e8b98c", w: 60, h: 70 }],
  upperarm_near: [{ suffix: "a", color: "#d9642f", w: 80, h: 180 }],
  forearm_near: [{ suffix: "a", color: "#c95a2a", w: 70, h: 170 }],
  hand_near: [{ suffix: "a", color: "#e8b98c", w: 60, h: 70 }],
  weapon_near: [{ suffix: "a", color: "#c9ced4", w: 40, h: 220, rarityMin: "Poco comun" }],
  thigh_far: [
    { suffix: "a", color: "#33294a", w: 90, h: 260 },
    { suffix: "b", color: "#2a2140", w: 90, h: 260 },
  ],
  shin_far: [{ suffix: "a", color: "#291f3d", w: 80, h: 220 }],
  foot_far: [{ suffix: "a", color: "#1a1610", w: 90, h: 60 }],
  thigh_near: [
    { suffix: "a", color: "#33294a", w: 90, h: 260 },
    { suffix: "b", color: "#2a2140", w: 90, h: 260 },
  ],
  shin_near: [{ suffix: "a", color: "#291f3d", w: 80, h: 220 }],
  foot_near: [{ suffix: "a", color: "#1a1610", w: 90, h: 60 }],
};

let cachedCatalog = null;

/** Genera (una vez, cacheado) el catalogo de piezas de prueba. */
export function buildTestCatalog() {
  if (cachedCatalog) return cachedCatalog;
  const catalog = [];
  for (const [slot, variants] of Object.entries(SLOT_VARIANTS)) {
    for (const v of variants) {
      catalog.push(
        makeRectPiece({
          id: `${slot}_${v.suffix}`,
          slot,
          color: v.color,
          width: v.w,
          height: v.h,
          rarityMin: v.rarityMin,
        })
      );
    }
  }
  cachedCatalog = catalog;
  return catalog;
}
