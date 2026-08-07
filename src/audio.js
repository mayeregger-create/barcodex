// src/audio.js
// Motor de sonido central. Dos fuentes distintas a propósito (ver charla en el chat):
// - SFX: sintetizados en el momento con Web Audio (osciladores) — nada de archivos que cargar,
//   y el timbre chiptune de 8-bit encaja mejor con la estética GBA que un sample grabado.
// - Música: 2 pistas en loop que vienen de afuera (Suno) — public/audio/ambient.mp3 (Título +
//   Escaneo) y public/audio/combat.mp3 (Combate). Si el archivo todavía no existe, playMusic()
//   falla en silencio (no rompe nada mientras no estén listas).
const MUTE_KEY = "barcodex_muted";

let ctx = null;
let unlocked = false;
let musicEl = null;
let currentTrack = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function isMuted() {
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted) {
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  if (musicEl) musicEl.muted = muted;
}

export function toggleMuted() {
  const next = !isMuted();
  setMuted(next);
  return next;
}

/** Llamar en el primer gesto real del usuario (el tap en "Jugar" del título) — los navegadores
 * bloquean audio hasta que haya una interacción, esto lo desbloquea para el resto de la sesión. */
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  const c = getCtx();
  if (c.state === "suspended") c.resume();
}

function beep({ freq = 440, duration = 0.08, type = "square", gain = 0.15, glideTo = null, delay = 0 }) {
  if (isMuted() || !unlocked) return;
  const c = getCtx();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function sfxTap() {
  beep({ freq: 720, duration: 0.05, type: "square", gain: 0.09 });
}

export function sfxScanSuccess() {
  beep({ freq: 660, duration: 0.09, type: "triangle", gain: 0.15 });
  beep({ freq: 880, duration: 0.14, type: "triangle", gain: 0.15, delay: 0.09 });
}

export function sfxHit() {
  beep({ freq: 180, duration: 0.09, type: "square", gain: 0.18, glideTo: 90 });
}

export function sfxBlock() {
  beep({ freq: 150, duration: 0.12, type: "sawtooth", gain: 0.15 });
}

export function sfxDodge() {
  beep({ freq: 500, duration: 0.05, type: "sine", gain: 0.1 });
  beep({ freq: 700, duration: 0.05, type: "sine", gain: 0.1, delay: 0.05 });
}

export function sfxAbility() {
  beep({ freq: 440, duration: 0.06, type: "triangle", gain: 0.15 });
  beep({ freq: 660, duration: 0.06, type: "triangle", gain: 0.15, delay: 0.06 });
  beep({ freq: 990, duration: 0.16, type: "triangle", gain: 0.15, delay: 0.12 });
}

export function sfxVictory() {
  [523, 659, 784, 1047].forEach((freq, i) => beep({ freq, duration: 0.2, type: "square", gain: 0.18, delay: i * 0.12 }));
}

export function sfxDefeat() {
  [392, 349, 311, 262].forEach((freq, i) => beep({ freq, duration: 0.24, type: "sawtooth", gain: 0.15, delay: i * 0.15 }));
}

// "Moss Gate Town" (título) / "Moonlit Save Point" (navegación interna: Escaneo, Codex, Equipo,
// Resultado) / "Circuit Breaker" 1 y 2 (combate, se alterna al azar cada vez que se entra a
// pelear — ver pickCombatTrack).
const TRACKS = {
  title: "/audio/title.mp3",
  ambient: "/audio/ambient.mp3",
  combat1: "/audio/combat1.mp3",
  combat2: "/audio/combat2.mp3",
};

/** Elige al azar entre las 2 pistas de combate — se llama una vez por entrada a pelear, no en
 * cada re-render (App.jsx solo la invoca cuando `screen` recien pasa a "combat"). */
export function pickCombatTrack() {
  return Math.random() < 0.5 ? "combat1" : "combat2";
}

export function playMusic(key) {
  // El guard tambien exige que ya este sonando de verdad (no solo que el nombre coincida): la
  // primera vez que se pide "title", en el montaje inicial, el navegador todavia bloquea audio
  // (no hubo gesto del usuario) y el .play() de mas abajo falla en silencio — currentTrack ya
  // queda en "title" pese a eso. Sin este chequeo extra, el reintento real (ya con el gesto del
  // primer tap, ver App.jsx#handleTitleStart) se saltearia por creer que "ya esta sonando".
  if (currentTrack === key && musicEl && !musicEl.paused) return;
  currentTrack = key;
  if (!musicEl) {
    musicEl = new Audio();
    musicEl.loop = true;
    musicEl.volume = 0.35;
    musicEl.muted = isMuted();
  }
  const src = key ? TRACKS[key] : null;
  if (!src) {
    musicEl.pause();
    return;
  }
  if (!musicEl.src.endsWith(src)) musicEl.src = src;
  musicEl.play().catch(() => {}); // silencioso si el archivo todavia no existe o el audio no se desbloqueo
}

export function stopMusic() {
  playMusic(null);
}
