// src/titiritero/framer.js
// (rareza, renderer) -> dibuja encima del personaje ya compuesto. Desacoplado del cuerpo (doc
// §5.3): no conoce huesos, solo rareza + las posiciones de mundo de las articulaciones visibles
// (para los remaches). 5 tiers (doc Generador de Cartas §11.4) — mismo vocabulario que
// cardgen/rarity.js: comun/poco_comun/rara/epica/legendaria.
const RAREZA_COLOR = {
  comun: "#8a8a8a",
  poco_comun: "#b08d57",
  rara: "#c9ced4",
  epica: "#e6c34d",
  legendaria: "#f2d675",
};

const RAREZA_BORDER_WIDTH = {
  comun: 4,
  poco_comun: 6,
  rara: 8,
  epica: 10,
  legendaria: 12,
};

// Subconjunto de huesos "articulacion visible" donde va un remache — no todos (las manos/pies no
// llevan, quedaria recargado). Ver doc §5.3: "se dibujan en las posiciones de los pivotes de las
// articulaciones visibles".
const RIVET_BONES = [
  "shoulder_far", "shoulder_near",
  "forearm_far", "forearm_near", // codo
  "thigh_far", "thigh_near",     // cadera/muslo
  "shin_far", "shin_near",       // rodilla
  "neck",
];

/**
 * Dibuja el marco de la carta + la capa de remaches, en espacio de CANVAS final (no de rig).
 * `cardRect` es el rectangulo real de la carta (letterboxeada 1200x1680 dentro del canvas — ver
 * index.js#computeCardRect); si no se pasa, usa el canvas entero (compatibilidad con llamadas
 * viejas que todavia no reservan margen fuera de la carta).
 */
export function drawFramer(ctx, { card, canvasWidth, canvasHeight, boneWorld, cardRect }) {
  const rect = cardRect || { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
  const color = RAREZA_COLOR[card.rareza] || RAREZA_COLOR.comun;
  const borderWidth = RAREZA_BORDER_WIDTH[card.rareza] || RAREZA_BORDER_WIDTH.comun;

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Remaches: un circulo con un highlight, en la posicion de mundo (ya en espacio de canvas
  // porque boneWorld ya viene compuesto con el baseMatrix de ajuste) de cada articulacion visible.
  for (const boneId of RIVET_BONES) {
    const m = boneWorld.get(boneId);
    if (!m) continue;
    const r = 6 + borderWidth * 0.3;
    ctx.beginPath();
    ctx.arc(m.e, m.f, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(m.e - r * 0.3, m.f - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
  }

  // Legendaria "desborda el marco" (doc §11.4/§13): un resplandor suave por fuera del borde real,
  // en vez de un marco mas — es la unica rareza cuyo marco no queda contenido en su propio rect.
  if (card.rareza === "legendaria") {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = color;
    ctx.strokeRect(rect.x + borderWidth / 2, rect.y + borderWidth / 2, rect.width - borderWidth, rect.height - borderWidth);
    ctx.restore();
  } else {
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = color;
    ctx.strokeRect(rect.x + borderWidth / 2, rect.y + borderWidth / 2, rect.width - borderWidth, rect.height - borderWidth);
  }

  if (card.rareza === "epica" || card.rareza === "legendaria") {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.strokeRect(
      rect.x + borderWidth + 4,
      rect.y + borderWidth + 4,
      rect.width - (borderWidth + 4) * 2,
      rect.height - (borderWidth + 4) * 2
    );
  }
}
