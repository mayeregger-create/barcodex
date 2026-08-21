// src/titiritero/data/humanoidRig.js
// El unico rig de la Tarea 1 (decision: solo topologias humanoides, ver chat). Arbol exacto del
// documento §3.2. Proporciones a mano, numeros redondos a proposito — son de referencia para
// probar la matematica de composicion, no medidas finales de arte (eso se ajusta cuando entren
// las piezas reales). Convencion: cada pieza de "brazo"/"pierna" se dibuja apuntando desde su
// pivote hacia ABAJO por defecto, asi rotacion 0 = postura relajada, colgando al costado del
// cuerpo — las Poses (data/poses.js) suman rotacion encima de esto.
export const HUMANOID_RIG = {
  id: "humanoid_v1",
  version: 1,
  canvas: { width: 1000, height: 1400 },
  groundY: 1330,
  bones: [
    { id: "root", parent: null, x: 500, y: 1330, rotation: 0 },
    { id: "hips", parent: "root", x: 0, y: -480, rotation: 0 },

    { id: "abdomen", parent: "hips", x: 0, y: -60, rotation: 0 },
    { id: "torso", parent: "abdomen", x: 0, y: -140, rotation: 0 },
    { id: "neck", parent: "torso", x: 0, y: -180, rotation: 0 },
    { id: "head", parent: "neck", x: 0, y: -40, rotation: 0 },

    { id: "shoulder_far", parent: "torso", x: -90, y: -140, rotation: 0 },
    { id: "upperarm_far", parent: "shoulder_far", x: 0, y: 0, rotation: 0 },
    { id: "forearm_far", parent: "upperarm_far", x: 0, y: 180, rotation: 0 },
    { id: "hand_far", parent: "forearm_far", x: 0, y: 160, rotation: 0 },

    { id: "shoulder_near", parent: "torso", x: 90, y: -140, rotation: 0 },
    { id: "upperarm_near", parent: "shoulder_near", x: 0, y: 0, rotation: 0 },
    { id: "forearm_near", parent: "upperarm_near", x: 0, y: 180, rotation: 0 },
    { id: "hand_near", parent: "forearm_near", x: 0, y: 160, rotation: 0 },

    { id: "thigh_far", parent: "hips", x: -40, y: 0, rotation: 0 },
    { id: "shin_far", parent: "thigh_far", x: 0, y: 260, rotation: 0 },
    { id: "foot_far", parent: "shin_far", x: 0, y: 220, rotation: 0 },

    { id: "thigh_near", parent: "hips", x: 40, y: 0, rotation: 0 },
    { id: "shin_near", parent: "thigh_near", x: 0, y: 260, rotation: 0 },
    { id: "foot_near", parent: "shin_near", x: 0, y: 220, rotation: 0 },
  ],
};
