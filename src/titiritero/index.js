// src/titiritero/index.js
// API publica del motor cliente. Dos puntos de entrada:
//   mountTitiritoreCard(canvas, character)       — personajes VIEJOS (character.js), sigue en
//                                                   produccion (CardHero.jsx / Partida Rapida).
//   mountTitiritoreCardFromGenerated(canvas, card) — cartas del generador NUEVO (cardgen/card.js).
// Ambos comparten el mismo core de animacion; solo cambia de donde sale el Card/pose/wash/texto.
import { fromTransform } from "./mat2d.js";
import { resolveCard } from "./resolver.js";
import { composeCard } from "./compositor.js";
import { createCanvas2DRenderer, preloadCatalog } from "./rendererCanvas2D.js";
import { drawFramer } from "./framer.js";
import { HUMANOID_RIG } from "./data/humanoidRig.js";
import { SLOT_REGISTRY } from "./data/slotRegistry.js";
import { poseForStance, stanceFromStation } from "./data/poses.js";
import { buildTestCatalog } from "./data/testPieces.js";
import { CONTINENT_COLORS } from "../core/pixelArt/palette.js";
import { LINEAGE_COLORS } from "./data/lineageColors.js";

// Proporcion real de la carta (doc Generador de Cartas §13): 1200x1680, 5:7 — coincide EXACTO con
// la proporcion del propio rig (1000x1400), asi que al escalar y centrar dentro del rect de carta
// el personaje llena el arte de punta a punta sin recortes ni bandas extra.
const CARD_ASPECT = 1200 / 1680;
const CARD_MARGIN_AT_1200 = 48; // doc §13: "margen de marco: 48 px" (a ancho de carta 1200)

const OLD_RAREZA_TO_NEW = { Comun: "comun", "Poco comun": "poco_comun", Raro: "rara", Epico: "epica" };

/** Personajes viejos (character.js) -> Card de Titiritero. La rareza se adapta al vocabulario
 * nuevo de 5 tiers en este borde — Titiritero por dentro solo conoce ese vocabulario (ver
 * resolver.js). Sin dato de postura real (el modelo viejo no tiene Estacion/Alcance), se fija en
 * "front" — el sabor de pose por Continente se retira junto con el modelo viejo. */
export function cardFromCharacter(character) {
  return {
    id: character.code,
    rareza: OLD_RAREZA_TO_NEW[character.rareza] || "comun",
    clase: character.clase,
    stance: "front",
    wash: CONTINENT_COLORS[character.continente]?.primary || "#3a2a4a",
    overrides: {},
  };
}

/** Carta del generador nuevo (cardgen/card.js) -> Card de Titiritero. La postura sale de la
 * propia Estacion de la carta (doc §14.1) — no hay tabla nueva que mantener. */
export function cardFromGeneratedCard(generated) {
  return {
    id: generated.code,
    rareza: generated.rarity,
    clase: generated.identity.class,
    stance: stanceFromStation(generated.combat.station),
    wash: LINEAGE_COLORS[generated.lineage]?.primary || "#3a2a4a",
    overrides: {},
    sourceCard: generated, // para dibujar coste/nombre/stats directo en el canvas, ver drawCardText
  };
}

function computeCardRect(canvasWidth, canvasHeight) {
  let width = canvasWidth;
  let height = width / CARD_ASPECT;
  if (height > canvasHeight) {
    height = canvasHeight;
    width = height * CARD_ASPECT;
  }
  return { x: (canvasWidth - width) / 2, y: (canvasHeight - height) / 2, width, height };
}

function computeBaseMatrix(cardRect) {
  const margin = (CARD_MARGIN_AT_1200 / 1200) * cardRect.width;
  const artWidth = cardRect.width - margin * 2;
  const artHeight = cardRect.height - margin * 2;
  const scale = Math.min(artWidth / HUMANOID_RIG.canvas.width, artHeight / HUMANOID_RIG.canvas.height);
  const offsetX = cardRect.x + (cardRect.width - HUMANOID_RIG.canvas.width * scale) / 2;
  const offsetY = cardRect.y + (cardRect.height - HUMANOID_RIG.canvas.height * scale) / 2;
  return fromTransform({ x: offsetX, y: offsetY, rotation: 0, scaleX: scale, scaleY: scale });
}

// Bandas de datos flotantes (doc §13: "arte a sangre completa con los datos flotando encima, no
// caja de arte con banda de texto") — degradado angosto arriba y abajo, no un panel opaco.
const BAND_FRACTION = 0.14;

function drawCardBands(ctx, cardRect) {
  const bandH = cardRect.height * BAND_FRACTION;
  const top = ctx.createLinearGradient(0, cardRect.y, 0, cardRect.y + bandH);
  top.addColorStop(0, "rgba(10,7,10,0.82)");
  top.addColorStop(1, "rgba(10,7,10,0)");
  ctx.fillStyle = top;
  ctx.fillRect(cardRect.x, cardRect.y, cardRect.width, bandH);

  const bottom = ctx.createLinearGradient(0, cardRect.y + cardRect.height - bandH, 0, cardRect.y + cardRect.height);
  bottom.addColorStop(0, "rgba(10,7,10,0)");
  bottom.addColorStop(1, "rgba(10,7,10,0.88)");
  ctx.fillStyle = bottom;
  ctx.fillRect(cardRect.x, cardRect.y + cardRect.height - bandH, cardRect.width, bandH);
}

const STATION_SYMBOL = { 1: "1", 2: "2", 3: "3" };

/** Coste + nombre arriba, Fuerza / Estacion-Alcance / Iniciativa abajo — horneado en el canvas
 * (no HTML encima): el mismo motor tiene que poder exportar esto como PNG estatico en servidor
 * algun dia (doc §1: "salida dual"), y un overlay HTML no viaja a esa salida. */
function drawCardText(ctx, cardRect, generated) {
  const { combat, cost, identity } = generated;
  const pad = cardRect.width * 0.045;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff8ec";

  // Coste, arriba a la izquierda — insignia circular.
  const costR = cardRect.width * 0.045;
  const costCx = cardRect.x + pad + costR;
  const costCy = cardRect.y + pad + costR;
  ctx.beginPath();
  ctx.arc(costCx, costCy, costR, 0, Math.PI * 2);
  ctx.fillStyle = "#2a1c34";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#f2d675";
  ctx.stroke();
  ctx.fillStyle = "#f2d675";
  ctx.font = `700 ${Math.round(costR * 1.15)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(String(cost), costCx, costCy + costR * 0.38);

  // Nombre, clase y epiteto — a la derecha del coste.
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff8ec";
  ctx.font = `700 ${Math.round(cardRect.width * 0.038)}px system-ui, sans-serif`;
  ctx.fillText(identity.displayName, costCx + costR + pad * 0.6, costCy + costR * 0.35);

  // Fuerza (abajo izq.), Estacion/Alcance (centro), Iniciativa (abajo der.)
  const bottomY = cardRect.y + cardRect.height - pad * 0.9;
  ctx.font = `700 ${Math.round(cardRect.width * 0.05)}px system-ui, sans-serif`;
  ctx.fillStyle = "#f2d675";
  ctx.textAlign = "left";
  ctx.fillText(`⚔ ${combat.strength}`, cardRect.x + pad, bottomY);

  ctx.textAlign = "right";
  ctx.fillText(`⚡ ${combat.initiative}`, cardRect.x + cardRect.width - pad, bottomY);

  ctx.textAlign = "center";
  ctx.font = `600 ${Math.round(cardRect.width * 0.032)}px system-ui, sans-serif`;
  ctx.fillStyle = "#e8dcd2";
  const stationText = combat.station.map((s) => STATION_SYMBOL[s]).join("");
  const reachText = combat.reachCore ? "Núcleo" : combat.reach.map((s) => STATION_SYMBOL[s]).join("");
  ctx.fillText(`${stationText} / ${reachText}`, cardRect.x + cardRect.width / 2, bottomY);
}

/**
 * Motor compartido de animacion. `card` ya viene armado por cardFromCharacter/cardFromGeneratedCard
 * (trae rareza/clase/stance/wash en el vocabulario interno de Titiritero).
 * @returns {() => void} cleanup — cancela el rAF.
 */
function mountCore(canvas, card) {
  const ctx = canvas.getContext("2d");
  const renderer = createCanvas2DRenderer(ctx);
  const catalog = buildTestCatalog();
  const { pieceMap, warnings } = resolveCard(card, catalog, SLOT_REGISTRY);
  if (warnings.length) console.warn("[titiritero]", card.id, warnings);

  const pose = poseForStance(card.stance);

  let raf = null;
  let cancelled = false;
  const start = performance.now();

  preloadCatalog(catalog).then(() => {
    if (cancelled) return;

    function frame(now) {
      try {
        const t = (now - start) / 1000;
        const w = canvas.width;
        const h = canvas.height;
        const cardRect = computeCardRect(w, h);
        const baseMatrix = computeBaseMatrix(cardRect);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#171018"; // fondo ambiente, se ve en los margenes fuera del rect de carta
        ctx.fillRect(0, 0, w, h);

        // Wash de fondo DENTRO del rect de carta — Linaje/Continente da el color, no una paleta
        // inventada (ver lineageColors.js / pixelArt/palette.js).
        const grad = ctx.createLinearGradient(0, cardRect.y, 0, cardRect.y + cardRect.height);
        grad.addColorStop(0, card.wash);
        grad.addColorStop(1, "#171018");
        ctx.fillStyle = grad;
        ctx.fillRect(cardRect.x, cardRect.y, cardRect.width, cardRect.height);

        // Luz que se mece suave — el vector de sombra oscila, no es fijo (ver chat: "se sienta viva").
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

        drawCardBands(ctx, cardRect);
        drawFramer(ctx, { card, canvasWidth: w, canvasHeight: h, boneWorld: world, cardRect });
        if (card.sourceCard) drawCardText(ctx, cardRect, card.sourceCard);
      } catch (err) {
        console.error("[titiritero] fallo dibujando un frame", err);
      }

      if (!cancelled) raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
  });

  return () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
  };
}

/** @param {HTMLCanvasElement} canvas @param {object} character - de generateCharacter(). */
export function mountTitiritoreCard(canvas, character) {
  return mountCore(canvas, cardFromCharacter(character));
}

/** @param {HTMLCanvasElement} canvas @param {object} generated - de cardgen/card.js#generateCard(). */
export function mountTitiritoreCardFromGenerated(canvas, generated) {
  return mountCore(canvas, cardFromGeneratedCard(generated));
}
