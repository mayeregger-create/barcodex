// src/core/itemSprite.js
// Arma la grilla + colorMap para el icono pixel-art de un item (reemplaza a itemImagePrompt.js).

import { CATEGORY_SPRITE } from "./pixelArt/itemSprites.js";
import { MATERIAL_COLORS, STAT_ACCENT, OUTLINE_COLOR, HIGHLIGHT_COLOR, shade } from "./pixelArt/palette.js";

export function itemSpriteSpec(item) {
  const grid = CATEGORY_SPRITE[item.categoria] ?? CATEGORY_SPRITE.Reliquia;
  const material = MATERIAL_COLORS[item.material];
  return {
    grid,
    colorMap: {
      1: material,
      2: shade(material, -25),
      // Fallback para categorias sin stat (Libro/Accesorio/Reliquia): un tinte MAS CLARO del
      // propio material, nunca un color fijo — asi nunca coincide con el material y se pierde
      // el detalle (paso con "Libro de Oro": el acento fijo daba el mismo dorado que el material).
      w: item.stat ? STAT_ACCENT[item.stat] : shade(material, 35),
      e: HIGHLIGHT_COLOR,
      outline: OUTLINE_COLOR,
    },
  };
}
