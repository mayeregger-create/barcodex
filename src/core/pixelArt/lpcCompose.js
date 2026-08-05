// src/core/pixelArt/lpcCompose.js
// Compone el retrato de un personaje apilando capas reales del Universal LPC Spritesheet
// Character Generator (ver public/lpc/CREDITS.md) en vez de pintar una grilla de color a mano.
// Cada capa es un spritesheet walk.png de 9 columnas x 4 filas (arriba/izquierda/frente/derecha),
// celdas de 64x64 — recortamos siempre la MISMA celda (fila derecha, primer frame) en todas las
// capas, porque el propio formato LPC garantiza que calzan entre si en esa celda.
import { CONTINENT_COLORS } from "./palette.js";

const FRAME = 64;
const FRAME_COL = 0;
const FRAME_ROW = 3; // 0=espalda, 1=izquierda, 2=frente, 3=derecha (de costado, mirando a la derecha)

// Assets por clase (ver public/lpc/CREDITS.md para la ruta original de cada uno en el repo LPC).
const CLASS_ASSET = {
  Guerrero: { legs: "guerrero", feet: "guerrero", torso: "guerrero", hats: ["guerrero"], weaponFront: "guerrero_front", weaponBack: "guerrero_back" },
  Tanque: { legs: "tanque", feet: "tanque", torso: "tanque", hats: ["tanque"], weaponSingle: "tanque" },
  Picaro: { legs: "picaro", feet: "picaro", torso: "picaro", hats: ["picaro"], weaponFront: "picaro_front", weaponBack: "picaro_back" },
  Mago: { legs: "mago", feet: "mago", torso: "mago", hats: ["mago"], weaponFront: "mago_front", weaponBack: "mago_back" },
  // El "cavalier feather" es solo la pluma (ver public/lpc/CREDITS.md) — necesita la capa base
  // (el sombrero en si) debajo, si no queda flotando en el aire sin nada que la sostenga.
  Bardo: { legs: "bardo", feet: "bardo", torso: "bardo", hats: ["bardo_base", "bardo_feather"] },
};

const SEXO_SUFFIX = { Masculino: "male", Femenino: "female" };

function layersFor(clase, sexo) {
  const suf = SEXO_SUFFIX[sexo];
  const cls = CLASS_ASSET[clase];
  const layers = [
    { src: `/lpc/body_${suf}.png`, zPos: 10 },
    { src: `/lpc/legs_${cls.legs}_${suf}.png`, zPos: 20, tint: true },
    { src: `/lpc/feet_${cls.feet}_${suf}.png`, zPos: 25 },
    { src: `/lpc/torso_${cls.torso}_${suf}.png`, zPos: 50, tint: true },
    { src: `/lpc/head_${suf}.png`, zPos: 100 },
    { src: `/lpc/hair_${suf}.png`, zPos: 120 },
    ...cls.hats.map((hat) => ({ src: `/lpc/hat_${hat}.png`, zPos: 130 })),
  ];
  if (cls.weaponBack) layers.push({ src: `/lpc/weapon_${cls.weaponBack}.png`, zPos: 9 });
  if (cls.weaponFront) layers.push({ src: `/lpc/weapon_${cls.weaponFront}.png`, zPos: 140 });
  if (cls.weaponSingle) layers.push({ src: `/lpc/weapon_${cls.weaponSingle}.png`, zPos: 140 });
  return layers.sort((a, b) => a.zPos - b.zPos);
}

const imageCache = new Map();
function loadImage(src) {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

// Recorta la celda de `img` y le aplica un tinte de color (blend "color": conserva la luminosidad
// del pixel original, reemplaza el matiz/saturacion) recortado a la silueta real de la capa —
// asi la ropa se lee del color de continente sin perder pliegues/sombreado del sprite original.
// Nota: el alpha de mezcla NO se aplica aca (un canvas offscreen no "recuerda" globalAlpha al ser
// dibujado en otro canvas) — lo aplica quien llama, en el ctx destino, al pegar el resultado.
function tintedCell(img, sx, sy, tint) {
  const off = document.createElement("canvas");
  off.width = FRAME;
  off.height = FRAME;
  const octx = off.getContext("2d");
  octx.drawImage(img, sx, sy, FRAME, FRAME, 0, 0, FRAME, FRAME);
  octx.globalCompositeOperation = "color";
  octx.fillStyle = tint;
  octx.fillRect(0, 0, FRAME, FRAME);
  octx.globalCompositeOperation = "destination-in";
  octx.drawImage(img, sx, sy, FRAME, FRAME, 0, 0, FRAME, FRAME);
  return off;
}

/** Dibuja el retrato del personaje en `canvas`, cargando y componiendo las capas LPC. Async
 * porque las imagenes se cargan por red (cacheadas: solo la primera vez por sesion). */
export async function drawLpcCharacter(canvas, character) {
  const { clase, sexo, continente } = character;
  const layers = layersFor(clase, sexo);
  const images = await Promise.all(layers.map((l) => loadImage(l.src)));

  const scale = 6;
  const size = FRAME * scale;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);

  const tint = CONTINENT_COLORS[continente].primary;
  const sx = FRAME_COL * FRAME;
  const sy = FRAME_ROW * FRAME;

  layers.forEach((layer, i) => {
    const img = images[i];
    ctx.globalAlpha = 1;
    ctx.drawImage(img, sx, sy, FRAME, FRAME, 0, 0, size, size);
    if (layer.tint) {
      const tinted = tintedCell(img, sx, sy, tint);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(tinted, 0, 0, FRAME, FRAME, 0, 0, size, size);
      ctx.globalAlpha = 1;
    }
  });
}
