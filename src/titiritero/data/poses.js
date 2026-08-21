// src/titiritero/data/poses.js
// 5 poses, una por Continente (decision del chat: no por Clase ni "archetype" — el continente
// define la postura). Primer pase de personalidad ligado a CONTINENT_TRAITS (continents.js):
// America=Adaptable (lista, apoyo asimetrico), Europa=Erudito (compuesta, simetrica), Asia=
// Disciplina (formal, pies juntos), Africa=Resiliencia (base ancha, plantada), Oceania=Endemico
// (suelta, asimetrica, unica). Valores conservadores dentro de los rangos maximos del §7.2 — son
// punto de partida, se afinan cuando entre arte real.
export const POSES = {
  America: {
    id: "stand_america",
    channels: {
      torso: { rotation: -1 },
      upperarm_near: { rotation: 6 },
      upperarm_far: { rotation: -4 },
    },
  },
  Europa: {
    id: "stand_europa",
    channels: {
      neck: { rotation: -2 },
      upperarm_near: { rotation: 3 },
      upperarm_far: { rotation: 3 },
    },
  },
  Asia: {
    id: "stand_asia",
    channels: {
      thigh_near: { rotation: 1 },
      thigh_far: { rotation: -1 },
    },
  },
  Africa: {
    id: "stand_africa",
    channels: {
      thigh_near: { rotation: 6 },
      thigh_far: { rotation: -6 },
      upperarm_near: { rotation: 4 },
      upperarm_far: { rotation: -4 },
    },
  },
  Oceania: {
    id: "stand_oceania",
    channels: {
      torso: { rotation: 2 },
      head: { rotation: -3 },
      upperarm_near: { rotation: -8 },
      upperarm_far: { rotation: 4 },
    },
  },
};

export function poseForContinente(continente) {
  return POSES[continente] || POSES.America;
}
