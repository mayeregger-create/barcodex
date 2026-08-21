// src/titiritero/index.js
// API publica del motor cliente: mountTitiritoreCard(canvas, character) monta el loop de animacion
// (requestAnimationFrame) que resuelve + compone + enmarca una carta viva. Devuelve una funcion de
// limpieza (cancela el rAF) — llamarla al desmontar el componente React que la usa.
import { fromTransform } from "./mat2d.js";
import { resolveCard } from "./resolver.js";
import { composeCard } from "./compositor.js";
import { createCanvas2DRenderer, preloadCatalog } from "./rendererCanvas2D.js";
import { drawFramer } from "./framer.js";
import { HUMANOID_RIG } from "./data/humanoidRig.js";
import { SLOT_REGISTRY } from "./data/slotRegistry.js";
import { poseForContinente } from "./data/poses.js";
import { buildTestCatalog } from "./data/testPieces.js";
import { CONTINENT_COLORS } from "../core/pixelArt/palette.js";

// 2/3 arte + 1/3 datos (decision del chat) — el canvas dibuja el card ENTERO (fondo + personaje +
// marco); el panel de datos en si es HTML encima (ver CardHero.jsx), esta franja del canvas queda
// como fondo continuo debajo de ese panel.
const ART_FRACTION = 2 / 3;

/** Arma el objeto Card de Titiritero a partir de un personaje real de BarCodex. */
export function cardFromCharacter(character) {
  return {
    id: character.code,
    rareza: character.rareza,
    clase: character.clase,
    continente: character.continente,
    sexo: character.sexo,
    habilidad: character.habilidad?.name,
    overrides: {},
  };
}

function computeBaseMatrix(canvasWidth, canvasHeight) {
  const artHeight = canvasHeight * ART_FRACTION;
  const scale = Math.min(canvasWidth / HUMANOID_RIG.canvas.width, artHeight / HUMANOID_RIG.canvas.height);
  const offsetX = (canvasWidth - HUMANOID_RIG.canvas.width * scale) / 2;
  const offsetY = artHeight - HUMANOID_RIG.canvas.height * scale;
  return fromTransform({ x: offsetX, y: offsetY, rotation: 0, scaleX: scale, scaleY: scale });
}

/**
 * @param {HTMLCanvasElement} canvas - ya dimensionado (canvas.width/height en px reales).
 * @param {object} character - personaje de generateCharacter().
 * @returns {() => void} cleanup — cancela la animacion.
 */
export function mountTitiritoreCard(canvas, character) {
  const ctx = canvas.getContext("2d");
  const renderer = createCanvas2DRenderer(ctx);
  const catalog = buildTestCatalog();
  const card = cardFromCharacter(character);
  const { pieceMap, warnings } = resolveCard(card, catalog, SLOT_REGISTRY);
  if (warnings.length) console.warn("[titiritero]", card.id, warnings);

  const pose = poseForContinente(card.continente);
  const baseMatrix = computeBaseMatrix(canvas.width, canvas.height);
  const wash = CONTINENT_COLORS[card.continente]?.primary || "#3a2a4a";

  let raf = null;
  let cancelled = false;
  const start = performance.now();

  preloadCatalog(catalog).then(() => {
    if (cancelled) return;

    function frame(now) {
      const t = (now - start) / 1000;
      const w = canvas.width;
      const h = canvas.height;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Fondo: wash suave del color de continente, mas oscuro hacia abajo (donde empieza el panel
      // de datos en HTML) para que el texto encima siempre tenga contraste sin importar la rareza.
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, wash);
      grad.addColorStop(ART_FRACTION, wash);
      grad.addColorStop(1, "#171018");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Luz que se mece suave — el vector de sombra oscila, no es fijo, asi la carta se siente
      // "con volumen bajo una luz real" y no un sticker plano (ver chat).
      const lightVector = { x: Math.sin(t * 0.35) * 0.5, y: -1 };

      const { world } = composeCard({
        pieceMap,
        rig: HUMANOID_RIG,
        pose,
        catalog,
        slotRegistry: SLOT_REGISTRY,
        renderer,
        t,
        lightVector,
        baseMatrix,
      });

      drawFramer(ctx, { card, canvasWidth: w, canvasHeight: h, boneWorld: world });

      if (!cancelled) raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
  });

  return () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
  };
}
