// src/titiritero/rendererCanvas2D.js
// Implementacion cliente de la interfaz Renderer (doc §5.2): drawPiece + drawShadow. El compositor
// no conoce esto — solo llama a la interfaz. La sombra es una silueta plana (filter brightness(0)
// + alpha bajo) desplazada por un vector de luz, no un shader de luz real: las piezas no se
// deforman (transformaciones afines rigidas nada mas), asi que no hace falta mas que eso para que
// se lea como "esta cosa tiene volumen y una luz le pega de un lado" (ver chat).
import { toArray } from "./mat2d.js";

const imageCache = new Map();
function getImage(src) {
  let entry = imageCache.get(src);
  if (!entry) {
    const img = new Image();
    img.src = src;
    entry = img;
    imageCache.set(src, img);
  }
  return entry;
}

/** Precarga todas las imagenes de un catalogo — llamar antes de animar para evitar el primer
 * frame con piezas "saltandose" por no estar cargadas todavia (img.complete === false). */
export function preloadCatalog(catalog) {
  return Promise.all(
    catalog.map(
      (p) =>
        new Promise((resolve) => {
          const img = getImage(p.image);
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // no bloquear todo el catalogo por una pieza rota
        })
    )
  );
}

const SHADOW_DISTANCE = 16; // unidades de rig
const SHADOW_ALPHA = 0.26;

export function createCanvas2DRenderer(ctx) {
  return {
    drawPiece(piece, matrix) {
      const img = getImage(piece.image);
      if (!img.complete || img.naturalWidth === 0) return;
      ctx.save();
      ctx.setTransform(...toArray(matrix));
      ctx.drawImage(img, -piece.pivot.x, -piece.pivot.y, piece.size.width, piece.size.height);
      ctx.restore();
    },
    drawShadow(piece, matrix, lightVector = { x: 0, y: -1 }) {
      const img = getImage(piece.image);
      if (!img.complete || img.naturalWidth === 0) return;
      const shifted = {
        ...matrix,
        e: matrix.e + lightVector.x * SHADOW_DISTANCE,
        f: matrix.f + lightVector.y * SHADOW_DISTANCE,
      };
      ctx.save();
      ctx.setTransform(...toArray(shifted));
      ctx.filter = "brightness(0)";
      ctx.globalAlpha = SHADOW_ALPHA;
      ctx.drawImage(img, -piece.pivot.x, -piece.pivot.y, piece.size.width, piece.size.height);
      ctx.restore();
    },
  };
}
