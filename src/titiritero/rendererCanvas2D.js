// src/titiritero/rendererCanvas2D.js
// Implementacion cliente de la interfaz Renderer (doc §5.2): drawPiece + drawShadow. El compositor
// no conoce esto — solo llama a la interfaz. La sombra es una silueta plana (misma silueta que la
// pieza, coloreada solida) desplazada por un vector de luz, no un shader de luz real: las piezas
// no se deforman (transformaciones afines rigidas nada mas), asi que no hace falta mas que eso
// para que se lea como "esta cosa tiene volumen y una luz le pega de un lado" (ver chat).
//
// La silueta se arma con globalCompositeOperation "source-in" (soportado por el Canvas 2D API
// desde siempre) en vez de ctx.filter = "brightness(0)" — filter es una API mas nueva que algunos
// navegadores/webviews de celular todavia no soportan bien (justo el contexto real de esta app:
// in-app browsers de WhatsApp/Instagram, Android WebView viejo), asi que se evita esa dependencia
// directamente en vez de asumir que el navegador del jugador la tiene.
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

const SHADOW_COLOR = "#0d0810";
const silhouetteCache = new Map();

/** Silueta solida (mismo alpha que la imagen, color plano) — se arma una sola vez por pieza y se
 * reusa en todos los frames. Si la imagen todavia no cargo, devuelve null (el llamador se salta
 * ese frame, no rompe nada). */
function getSilhouette(img, src) {
  let sil = silhouetteCache.get(src);
  if (sil) return sil;
  if (!img.complete || img.naturalWidth === 0) return null;

  const off = document.createElement("canvas");
  off.width = img.naturalWidth;
  off.height = img.naturalHeight;
  const octx = off.getContext("2d");
  octx.drawImage(img, 0, 0);
  octx.globalCompositeOperation = "source-in";
  octx.fillStyle = SHADOW_COLOR;
  octx.fillRect(0, 0, off.width, off.height);

  silhouetteCache.set(src, off);
  return off;
}

/** Precarga todas las imagenes (y arma sus siluetas) de un catalogo — llamar antes de animar para
 * evitar el primer frame con piezas "saltandose" por no estar cargadas todavia. */
export function preloadCatalog(catalog) {
  return Promise.all(
    catalog.map(
      (p) =>
        new Promise((resolve) => {
          const img = getImage(p.image);
          const done = () => {
            getSilhouette(img, p.image);
            resolve();
          };
          if (img.complete) return done();
          img.onload = done;
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
      const silhouette = getSilhouette(img, piece.image);
      if (!silhouette) return;
      const shifted = {
        ...matrix,
        e: matrix.e + lightVector.x * SHADOW_DISTANCE,
        f: matrix.f + lightVector.y * SHADOW_DISTANCE,
      };
      ctx.save();
      ctx.setTransform(...toArray(shifted));
      ctx.globalAlpha = SHADOW_ALPHA;
      ctx.drawImage(silhouette, -piece.pivot.x, -piece.pivot.y, piece.size.width, piece.size.height);
      ctx.restore();
    },
  };
}
