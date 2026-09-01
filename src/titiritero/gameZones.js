// src/titiritero/gameZones.js
// Puente entre las 5 zonas del juego (cardgen/zones.js: head/torso/armMain/armOff/legs) y los
// huesos del rig de Titiritero — para que una zona rota se vea, no solo se lea en un numero (la
// idea central del juego: "no pierden puntos de vida, pierden partes", ver chat).
//
// Convencion elegida (no esta en ningun doc, es una decision de implementacion): armMain = lado
// "near" del rig (el mas al frente en el z-order), armOff = lado "far". El torso roto saca a la
// unidad del tablero por completo (doc §4.1: "la unidad cae") — no tiene animacion de colgar
// propia, por eso no aparece en este mapa.
export const ZONE_DANGLE_BONES = {
  head: ["neck"],
  armMain: ["upperarm_near"],
  armOff: ["upperarm_far"],
  legs: ["thigh_near", "thigh_far"],
  torso: [],
};

export function dangleBonesForBrokenZones(brokenZoneNames) {
  const bones = new Set();
  for (const zone of brokenZoneNames) {
    for (const b of ZONE_DANGLE_BONES[zone] || []) bones.add(b);
  }
  return bones;
}

// Angulo base "colgando flojo" por hueso (grados) + un vaiven lento e independiente del sway
// normal (una extremidad rota se mece mas libre, no controlada) — la rotacion en reposo de estos
// huesos YA es "brazo/pierna colgando relajado" (ver humanoidRig.js), asi que roto necesita un
// angulo mas exagerado/asimetrico para leerse como "esto ya no responde", no como reposo normal.
const DANGLE_CONFIG = {
  neck: { angle: 55, swingAmplitude: 9, swingSpeed: 0.4 },
  upperarm_near: { angle: 55, swingAmplitude: 11, swingSpeed: 0.35 },
  upperarm_far: { angle: -55, swingAmplitude: 11, swingSpeed: 0.37 },
  thigh_near: { angle: 26, swingAmplitude: 6, swingSpeed: 0.3 },
  thigh_far: { angle: -26, swingAmplitude: 6, swingSpeed: 0.32 },
};

/** Rotacion (grados) de un hueso "colgando" en el instante t — reemplaza por completo a la
 * rotacion de pose+sway normal de ese hueso (ver compositor.js#computeWorldTransforms). null si
 * este hueso no tiene animacion de colgar (no esta roto). */
export function dangleRotationForBone(boneId, t) {
  const cfg = DANGLE_CONFIG[boneId];
  if (!cfg) return null;
  return cfg.angle + Math.sin(t * cfg.swingSpeed) * cfg.swingAmplitude;
}
