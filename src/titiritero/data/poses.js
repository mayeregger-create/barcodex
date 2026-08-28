// src/titiritero/data/poses.js
// 4 poses por POSTURA (doc Generador de Cartas §14.1) — reemplaza el esquema anterior por
// Continente (decision del chat: el sistema nuevo ya no tiene continente, tiene Linaje, y las
// poses ahora expresan donde pelea la unidad, no de donde viene).
//
//   stand_front — posicion 1: plantado, guardia baja, peso adelante
//   stand_mid   — posicion 2: media estocada, cuerpo de perfil
//   stand_back  — posicion 3: retraido, arma en alto o canalizando
//   regent      — carta investida como Regente
//
// Valores conservadores dentro de los rangos maximos del doc de reglas (torso ±3°, neck/head ±6°,
// etc.) — primer pase, se afina cuando entre arte real.
export const POSES = {
  front: {
    id: "stand_front",
    channels: {
      torso: { rotation: 2 },
      thigh_near: { rotation: 3 },
      thigh_far: { rotation: -3 },
      upperarm_near: { rotation: 6 },
      upperarm_far: { rotation: -8 },
    },
  },
  mid: {
    id: "stand_mid",
    channels: {
      torso: { rotation: -6 }, // perfil: el giro visible mas grande de las 3 posturas
      upperarm_near: { rotation: -4 },
      upperarm_far: { rotation: 4 },
    },
  },
  back: {
    id: "stand_back",
    channels: {
      torso: { rotation: -1 },
      neck: { rotation: 3 },
      upperarm_near: { rotation: -18 }, // arma en alto / canalizando
      upperarm_far: { rotation: -2 },
    },
  },
  regent: {
    id: "regent",
    channels: {
      torso: { rotation: 0 },
      neck: { rotation: -3 }, // mas erguido, sin el giro de combate
      upperarm_near: { rotation: 3 },
      upperarm_far: { rotation: 3 },
    },
  },
};

export function poseForStance(stance) {
  return POSES[stance] || POSES.front;
}

/** Deriva la postura de la carta a partir de su propio dato generado (combat.station) — no hay
 * tabla nueva que mantener, la postura sale de lo que la carta ya es. Blunt/Cut (estacion incluye
 * 1, no incluye 3) -> front; Pierce (estacion 2-3, no incluye 1) -> back; Magic (cualquiera) ->
 * mid, el punto medio entre las otras dos. */
export function stanceFromStation(station) {
  const has1 = station.includes(1);
  const has3 = station.includes(3);
  if (has1 && !has3) return "front";
  if (has3 && !has1) return "back";
  return "mid";
}
