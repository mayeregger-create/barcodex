// src/core/pixelArt/drawSprite.js
// Dibuja una grilla de sprite (ver characterSprites.js/itemSprites.js) en un <canvas>, pixel a
// pixel, sin ninguna llamada de red — reemplaza al pedido a Pollinations.ai / Stable Diffusion.
// Referencias estudiadas: capturas de Castlevania (Symphony of the Night / DS) que el usuario
// mando al chat — sombreado con varios tonos por prenda (no solo claro/oscuro), no bloques planos.
//
// Estilo "sel-out" (selective outlining, tecnica real de pixel art moderno): en vez de un contorno
// negro parejo, cada costura usa una sombra oscura del propio color de la region vecina, y el
// borde de ARRIBA de cada region (donde "pega la luz") no lleva costura — se funde directo con el
// fondo. Sobre eso, sombreado DEGRADADO (no solo 2 tonos): cada region calcula su propia altura de
// principio a fin y aclara/oscurece en varios pasos segun que tan arriba/abajo esta cada celda
// dentro de esa region — el efecto pictorico de varias capas de tono que se ve en las referencias.

import { shade } from "./palette.js";

export function drawSprite(ctx, grid, colorMap, scale = 12) {
  const rows = grid.length;
  const cols = grid[0].length;
  ctx.canvas.width = cols * scale;
  ctx.canvas.height = rows * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const at = (r, c) => (r >= 0 && r < rows && c >= 0 && c < cols ? grid[r][c] : ".");
  const colorOf = (key) => colorMap[key] ?? "#ff00ff";

  // Altura del tramo continuo (misma columna, mismo codigo) al que pertenece (r,c): de donde
  // arranca a donde termina, escaneando hacia arriba y abajo. Sirve para ubicar cada celda dentro
  // de un degrade 0 (arriba, claro) a 1 (abajo, oscuro) propio de esa region, no de la fila global.
  function runSpan(r, c, key) {
    let top = r;
    while (at(top - 1, c) === key) top--;
    let bottom = r;
    while (at(bottom + 1, c) === key) bottom++;
    return { top, bottom };
  }

  // Pase 1: costura sel-out — celda por celda, no un solo color de fondo. Cada celda de borde
  // toma una sombra oscura del color de la region vecina (la propia si esta pintada, o la del
  // primer vecino pintado si es hueco de silueta exterior).
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = grid[r][c];
      const up = at(r - 1, c);
      const down = at(r + 1, c);
      const left = at(r, c - 1);
      const right = at(r, c + 1);
      const isBoundary = key === "." ? [up, down, left, right].some((n) => n !== ".") : [up, down, left, right].some((n) => n !== key);
      if (!isBoundary) continue;
      const refKey = key !== "." ? key : [up, down, left, right].find((n) => n !== ".");
      if (!refKey) continue;
      ctx.fillStyle = shade(colorOf(refKey), -45);
      ctx.fillRect(c * scale, r * scale, scale, scale);
    }
  }

  // Pase 2: cada celda pintada, con degrade propio (no solo 2 tonos: se ubica dentro de SU tramo
  // vertical y aclara arriba / oscurece abajo en proporcion, con varios pasos intermedios) y
  // "comida" hacia adentro en los bordes izq/der/abajo que colinden con otra region — pero NO
  // arriba: ese borde llega hasta el filo sin costura (el lado iluminado "se abre").
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = grid[r][c];
      if (key === ".") continue;

      const { top, bottom } = runSpan(r, c, key);
      const span = bottom - top;
      // t: 0 en la punta de arriba del tramo, 1 en la de abajo. Con tramos de 1 sola celda t=0.5
      // (tono neutro, ni el mas claro ni el mas oscuro).
      const t = span === 0 ? 0.5 : (r - top) / span;
      // Curva -24 (bien claro) a +... en realidad shade() usa positivo=aclarar, asi que mapeamos
      // t=0 -> +22 (claro), t=1 -> -34 (oscuro), con pasos intermedios reales (no un salto binario).
      const shadeAmt = 22 - t * 56;
      const color = shade(colorOf(key), shadeAmt);

      const leftEdge = at(r, c - 1) !== key ? 1 : 0;
      const rightEdge = at(r, c + 1) !== key ? 1 : 0;
      const bottomEdge = at(r + 1, c) !== key ? 1 : 0;

      ctx.fillStyle = color;
      ctx.fillRect(
        c * scale + leftEdge,
        r * scale,
        scale - leftEdge - rightEdge,
        scale - bottomEdge
      );
    }
  }
}
