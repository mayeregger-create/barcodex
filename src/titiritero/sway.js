// src/titiritero/sway.js
// Nivel 0 de animacion (doc §7.1): seno desfasado sobre unos pocos huesos, sin keyframes. Barato
// (funciona en cualquier carta automaticamente) y es justo lo que hace falta para que la carta se
// sienta viva en la vista hero — se metio DENTRO del alcance de la tarea 1 a proposito (ver chat),
// en vez de dejarlo para despues. Amplitudes bien por debajo de los rangos maximos del §7.2 (torso
// ±3°, neck/head ±6°) porque esto se SUMA encima de la rotacion de pose — entre pose + sway nunca
// deberia superar ese rango, o el solape de arte pensado para esos rangos deja de alcanzar.
const SWAY_CONFIG = {
  abdomen: { amplitude: 1, speed: 0.6, phase: 0 },
  torso: { amplitude: 1.5, speed: 0.6, phase: 0.3 },
  neck: { amplitude: 2.5, speed: 0.55, phase: 0.7 },
  head: { amplitude: 3, speed: 0.5, phase: 1.1 },
};

/** t en segundos. Devuelve grados a sumar a la rotacion de reposo+pose de ese hueso. */
export function swayOffsetForBone(boneId, t) {
  const cfg = SWAY_CONFIG[boneId];
  if (!cfg) return 0;
  return Math.sin(t * cfg.speed + cfg.phase) * cfg.amplitude;
}
