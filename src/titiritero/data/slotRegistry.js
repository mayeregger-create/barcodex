// src/titiritero/data/slotRegistry.js
// Tabla de slots del documento Titiritero §3.3 + prefijo de topologia (doc Generador de Cartas
// §14): "una decision barata ahora evita una migracion cara despues" — cuando exista un segundo
// rig (cuadrupedo, etc.) sus slots van a vivir bajo su propio prefijo sin chocar con estos. Los
// slots `rivets`/`frame` quedan SIN prefijo a proposito: no cuelgan de un hueso (se dibujan en
// espacio de carta, ver framer.js) y no son especificos de ninguna topologia — cualquier rig los
// necesita igual.
export const SLOT_REGISTRY = [
  { id: "humanoid.cape_back", bone: "torso", z: 10, required: false },
  { id: "humanoid.upperarm_far", bone: "upperarm_far", z: 20, required: true },
  { id: "humanoid.upperarm_far_cloth", bone: "upperarm_far", z: 21, required: false },
  { id: "humanoid.forearm_far", bone: "forearm_far", z: 22, required: true },
  { id: "humanoid.forearm_far_cloth", bone: "forearm_far", z: 23, required: false },
  { id: "humanoid.hand_far", bone: "hand_far", z: 24, required: true },
  { id: "humanoid.weapon_far", bone: "hand_far", z: 25, required: false },
  { id: "humanoid.pauldron_far", bone: "shoulder_far", z: 26, required: false },
  { id: "humanoid.thigh_far", bone: "thigh_far", z: 30, required: true },
  { id: "humanoid.thigh_far_cloth", bone: "thigh_far", z: 31, required: false },
  { id: "humanoid.shin_far", bone: "shin_far", z: 32, required: true },
  { id: "humanoid.shin_far_armor", bone: "shin_far", z: 33, required: false },
  { id: "humanoid.foot_far", bone: "foot_far", z: 34, required: true },
  { id: "humanoid.thigh_near", bone: "thigh_near", z: 40, required: true },
  { id: "humanoid.thigh_near_cloth", bone: "thigh_near", z: 41, required: false },
  { id: "humanoid.shin_near", bone: "shin_near", z: 42, required: true },
  { id: "humanoid.shin_near_armor", bone: "shin_near", z: 43, required: false },
  { id: "humanoid.foot_near", bone: "foot_near", z: 44, required: true },
  { id: "humanoid.hips", bone: "hips", z: 50, required: true },
  { id: "humanoid.hips_armor", bone: "hips", z: 51, required: false },
  { id: "humanoid.abdomen", bone: "abdomen", z: 55, required: true },
  { id: "humanoid.abdomen_armor", bone: "abdomen", z: 56, required: false },
  { id: "humanoid.torso", bone: "torso", z: 60, required: true },
  { id: "humanoid.torso_cloth", bone: "torso", z: 61, required: false },
  { id: "humanoid.torso_armor", bone: "torso", z: 62, required: false },
  { id: "humanoid.head", bone: "head", z: 70, required: true },
  { id: "humanoid.head_hair", bone: "head", z: 71, required: false },
  { id: "humanoid.head_face", bone: "head", z: 72, required: false },
  { id: "humanoid.helmet", bone: "head", z: 73, required: false },
  { id: "humanoid.upperarm_near", bone: "upperarm_near", z: 80, required: true },
  { id: "humanoid.upperarm_near_cloth", bone: "upperarm_near", z: 81, required: false },
  { id: "humanoid.pauldron_near", bone: "shoulder_near", z: 82, required: false },
  { id: "humanoid.forearm_near", bone: "forearm_near", z: 84, required: true },
  { id: "humanoid.forearm_near_cloth", bone: "forearm_near", z: 85, required: false },
  { id: "humanoid.hand_near", bone: "hand_near", z: 86, required: true },
  { id: "humanoid.weapon_near", bone: "hand_near", z: 87, required: false },
  { id: "rivets", bone: null, z: 95, required: true },
  { id: "frame", bone: null, z: 99, required: true },
];

export const REQUIRED_BODY_SLOTS = SLOT_REGISTRY.filter((s) => s.required && s.bone);
