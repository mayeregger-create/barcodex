// src/data/abilities.js
// Indexadas por el digito verificador D13 (0-9). Ver diseño_juego_codigo_barras.md seccion 5.

export const ABILITIES = [
  { name: "Golpe veloz", desc: "Ataca dos veces con daño reducido cada golpe", tipo: "Ofensiva",
    prop: "a single motion-blur afterimage hugging the silhouette" },
  { name: "Golpe certero", desc: "No puede fallar; bonus si Velocidad > rival", tipo: "Ofensiva",
    prop: "a small glowing targeting mark on the weapon tip" },
  { name: "Piel de corteza", desc: "Reduce el daño recibido a la mitad este turno", tipo: "Defensiva",
    prop: "bark-like glowing cracks on the skin and armor" },
  { name: "Drenaje", desc: "Parte del daño causado se convierte en Energía propia", tipo: "Utilidad",
    prop: "a thin glowing energy thread toward the target" },
  { name: "Grito de guerra", desc: "Sube la Fuerza de forma permanente en el combate", tipo: "Buff",
    prop: "a subtle red aura outline with small cracks under the feet" },
  { name: "Paso fantasma", desc: "Esquiva automáticamente el próximo ataque", tipo: "Defensiva",
    prop: "a semi-transparent silhouette with a single blue afterimage trail" },
  { name: "Fortuna del mercader", desc: "50% doble daño / 50% pierde el turno", tipo: "Riesgo (Suerte)",
    prop: "a few coins glinting near the hand, faint golden light" },
  { name: "Regeneración", desc: "Recupera HP durante varios turnos", tipo: "Sostenida",
    prop: "a soft green glow around the hands" },
  { name: "Grito paralizante", desc: "El rival pierde su próxima acción", tipo: "Control",
    prop: "a single faint shockwave ring near the mouth" },
  { name: "Golpe definitivo", desc: "Daño masivo, gasta toda la Energía", tipo: "Ofensiva (todo o nada)",
    prop: "energy tightly concentrated on the weapon" },
];

// src/data/classes.js consolidado aca para mantener el paquete chico.
// "symbol": inicial usada en la insignia de clase del retrato (ver .clase-badge en index.css) —
// las 5 son unicas, sin choques.
export const CLASSES = {
  Fuerza: { name: "Guerrero", passive: "+10% de daño en ataques básicos", weapon: "Espada grande",
    symbol: "G", parry: { block: 0.50, reflect: 0.50 } },
  Velocidad: { name: "Picaro", passive: "Gana los empates de Velocidad automáticamente", weapon: "Dagas gemelas",
    symbol: "P", parry: { block: 0.35, reflect: 0.70 } },
  Defensa: { name: "Tanque", passive: "-15% de daño recibido adicional", weapon: "Escudo",
    symbol: "T", parry: { block: 0.70, reflect: 0.30 } },
  Energia: { name: "Mago", passive: "Recupera Energía extra al usar Parry", weapon: "Bastón / orbe",
    symbol: "M", parry: { block: 0.40, reflect: 0.40 } }, // reflect aca carga Energia, no daño
  Suerte: { name: "Bardo", passive: "Probabilidad de crítico duplicada", weapon: "Dados / cartas",
    symbol: "B", parry: { block: null, reflect: null } }, // block = Suerte/100 (clamp 0.2-0.8), reflect = random 0.2-0.8
};

export const STAT_ORDER = ["Fuerza", "Velocidad", "Defensa", "Energia", "Suerte"];

// Bonus por rareza (seccion 2, ligado a las repeticiones de digitos). Chico a proposito:
// se aplica a la estadistica dominante del personaje, y se reusa para amplificar los buffs
// de equipo en squad.js (ahi es donde la ventaja del mas raro se nota de verdad).
export const RAREZA_BONUS = { Comun: 0, "Poco comun": 1, Raro: 2, Epico: 3 };

// Titulos alternativos por clase, para el "epiteto" del nombre (seccion 2 extendida).
export const CLASS_ROLES = {
  Guerrero: ["Guerrero", "Héroe", "Campeón", "Paladín", "Centinela"],
  Picaro: ["Pícaro", "Ladrón", "Asesino", "Explorador", "Merodeador"],
  Tanque: ["Tanque", "Guardián", "Custodio", "Baluarte", "Escudero"],
  Mago: ["Mago", "Hechicero", "Druida", "Ilusionista", "Nigromante"],
  Bardo: ["Bardo", "Trovador", "Juglar", "Encantador", "Rapsoda"],
};

// 5 adjetivos por habilidad especial (mismo orden que ABILITIES), para el "epiteto" del nombre.
export const ABILITY_ADJECTIVES = [
  ["Veloz", "Raudo", "Fulmíneo", "Presuroso", "Vertiginoso"], // Golpe veloz
  ["Certero", "Infalible", "Preciso", "Letal", "Implacable"], // Golpe certero
  ["Tenaz", "Infatigable", "Resistente", "Férreo", "Inquebrantable"], // Piel de corteza
  ["Vampírico", "Absorbente", "Insaciable", "Parasitario", "Devorador"], // Drenaje
  ["Feroz", "Bravío", "Indomable", "Salvaje", "Colérico"], // Grito de guerra
  ["Fantasmal", "Etéreo", "Esquivo", "Sigiloso", "Evanescente"], // Paso fantasma
  ["Audaz", "Temerario", "Arriesgado", "Osado", "Impredecible"], // Fortuna del mercader
  ["Resiliente", "Perdurable", "Vital", "Renaciente", "Incansable"], // Regeneración
  ["Aterrador", "Dominante", "Imponente", "Intimidante", "Despiadado"], // Grito paralizante
  ["Devastador", "Apocalíptico", "Arrollador", "Colosal", "Definitivo"], // Golpe definitivo
];
