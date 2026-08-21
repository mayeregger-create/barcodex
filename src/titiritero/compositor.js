// src/titiritero/compositor.js
// (pieceMap, rig, pose, renderer) -> dibuja. No sabe nada del backend (Canvas2D vs servidor): solo
// llama a la interfaz Renderer (ver rendererCanvas2D.js). Doc §5.2 + el sway de Nivel 0 (§7,
// metido en el alcance de la tarea 1 a proposito, ver chat) + una pasada de sombra por pieza.
import { fromTransform, multiply, identity } from "./mat2d.js";
import { swayOffsetForBone } from "./sway.js";

/** Matrices mundiales de cada hueso: reposo (rig) + pose (canal) + sway (t), acumuladas desde
 * `baseMatrix` (el fit del espacio de rig al canvas final — la compone quien llama, ver index.js). */
export function computeWorldTransforms(rig, pose, t = 0, { baseMatrix = identity(), swayIntensity = 1 } = {}) {
  const boneById = new Map(rig.bones.map((b) => [b.id, b]));
  const world = new Map();

  function computeFor(bone) {
    if (world.has(bone.id)) return world.get(bone.id);
    const poseRotation = pose?.channels?.[bone.id]?.rotation || 0;
    const sway = swayOffsetForBone(bone.id, t) * swayIntensity;
    const local = fromTransform({
      x: bone.x,
      y: bone.y,
      rotation: (bone.rotation || 0) + poseRotation + sway,
      scaleX: bone.scaleX ?? 1,
      scaleY: bone.scaleY ?? 1,
    });
    const parentMatrix = bone.parent ? computeFor(boneById.get(bone.parent)) : baseMatrix;
    const m = multiply(parentMatrix, local);
    world.set(bone.id, m);
    return m;
  }

  for (const bone of rig.bones) computeFor(bone);
  return world;
}

/**
 * Compone y dibuja un frame de la carta (sin el Framer — eso es una capa aparte, ver framer.js).
 * @param {object} opts
 * @param {Map<string,string>} opts.pieceMap - slotId -> pieceId (salida del resolver)
 * @param {object} opts.rig - HUMANOID_RIG
 * @param {object} opts.pose - una entrada de POSES
 * @param {object[]} opts.catalog - piezas (para resolver pieceId -> Piece)
 * @param {object[]} opts.slotRegistry - SLOT_REGISTRY
 * @param {object} opts.renderer - implementacion de Renderer (drawPiece/drawShadow)
 * @param {number} opts.t - tiempo en segundos, para el sway
 * @param {{x:number,y:number}} opts.lightVector - direccion de luz para la sombra por pieza
 */
export function composeCard({
  pieceMap,
  rig,
  pose,
  catalog,
  slotRegistry,
  renderer,
  t = 0,
  lightVector = { x: 0, y: -1 },
  baseMatrix = identity(),
  swayIntensity = 1,
}) {
  const world = computeWorldTransforms(rig, pose, t, { baseMatrix, swayIntensity });
  const pieceById = new Map(catalog.map((p) => [p.id, p]));

  const drawList = [];
  for (const slotDef of slotRegistry) {
    if (!slotDef.bone) continue; // rivets/frame: no son parte del cuerpo, los maneja el Framer
    const pieceId = pieceMap.get(slotDef.id);
    if (!pieceId) continue;
    const piece = pieceById.get(pieceId);
    if (!piece) continue;
    const matrix = world.get(slotDef.bone);
    if (!matrix) continue;
    drawList.push({ slotDef, piece, matrix });
  }
  drawList.sort((a, b) => a.slotDef.z - b.slotDef.z);

  // Sombra primero (todas las piezas, silueta oscura desplazada por la luz), despues el arte real
  // encima — asi ninguna sombra de una pieza tapa el arte de otra que va mas "adelante" en z.
  for (const { piece, matrix } of drawList) renderer.drawShadow(piece, matrix, lightVector);
  for (const { piece, matrix } of drawList) renderer.drawPiece(piece, matrix);

  return { world, drawList };
}
