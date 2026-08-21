// src/titiritero/framer.js
// (rareza, renderer) -> dibuja encima del personaje ya compuesto. Desacoplado del cuerpo (doc
// §5.3): no conoce huesos, solo rareza + las posiciones de mundo de las articulaciones visibles
// (para los remaches). Colores = los MISMOS 4 que ya usa toda la app en .rareza-frame--* (index.css)
// — no se inventa una paleta nueva, se hereda la que ya es la fuente de verdad (ver chat).
const RAREZA_COLOR = {
  Comun: "#8a8a8a",
  "Poco comun": "#b08d57",
  Raro: "#c9ced4",
  Epico: "#e6c34d",
};

const RAREZA_BORDER_WIDTH = {
  Comun: 4,
  "Poco comun": 6,
  Raro: 8,
  Epico: 10,
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

/** Dibuja el marco de la carta + la capa de remaches, en espacio de CANVAS final (no de rig). */
export function drawFramer(ctx, { card, canvasWidth, canvasHeight, boneWorld }) {
  const color = RAREZA_COLOR[card.rareza] || RAREZA_COLOR.Comun;
  const borderWidth = RAREZA_BORDER_WIDTH[card.rareza] || RAREZA_BORDER_WIDTH.Comun;

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

  // Marco de la carta entera.
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = color;
  ctx.strokeRect(borderWidth / 2, borderWidth / 2, canvasWidth - borderWidth, canvasHeight - borderWidth);

  if (card.rareza === "Epico") {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.strokeRect(borderWidth + 4, borderWidth + 4, canvasWidth - (borderWidth + 4) * 2, canvasHeight - (borderWidth + 4) * 2);
  }
}
