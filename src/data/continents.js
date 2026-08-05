// src/data/continents.js
// Prefijos GS1 reales -> continente. Cubre los rangos oficialmente asignados;
// el fallback por modulo solo aplica a codigos verdaderamente no asignados.

export const CONTINENT_ORDER = ["America", "Oceania", "Europa", "Asia", "Africa"];
// Orden fijo del pentagono. Afin = vecino (distancia 1). Rival = cruzado (distancia 2).

export const CONTINENT_TRAITS = {
  America: { name: "Adaptable", desc: "Bonus a la estadistica que ya sea mas alta" },
  Europa: { name: "Erudito", desc: "Bonus fijo a Energia" },
  Asia: { name: "Disciplina", desc: "Bonus fijo a Defensa" },
  Africa: { name: "Resiliencia", desc: "Bonus fijo a Fuerza" },
  Oceania: { name: "Endemico", desc: "Bonus a la estadistica mas baja + rareza garantizada Rara/Epica" },
};

export const HUES = {
  coral: { bg: "#FAECE7", mid: "#D85A30", dark: "#712B13" },
  purple: { bg: "#EEEDFE", mid: "#7F77DD", dark: "#3C3489" },
  teal: { bg: "#E1F5EE", mid: "#1D9E75", dark: "#085041" },
  amber: { bg: "#FAEEDA", mid: "#BA7517", dark: "#633806" },
  pink: { bg: "#FBEAF0", mid: "#D4537E", dark: "#72243E" },
};
export const CONTINENT_HUE = { America: "coral", Europa: "purple", Asia: "teal", Africa: "amber", Oceania: "pink" };
export const CLASS_HUE = { Guerrero: "coral", Picaro: "teal", Tanque: "amber", Mago: "purple", Bardo: "pink" };

// Rangos GS1 oficiales (por pais, agrupados por continente). Ver docs/diseño_juego_codigo_barras.md seccion 3.
const RANGES = [
  [0, 139, "America"],       // EE.UU / Canada
  [300, 379, "Europa"],      // Francia y Monaco
  [380, 380, "Europa"],      // Bulgaria
  [383, 383, "Europa"],      // Eslovenia
  [385, 385, "Europa"],      // Croacia
  [387, 387, "Europa"],      // Bosnia
  [389, 389, "Europa"],      // Montenegro
  [400, 440, "Europa"],      // Alemania
  [450, 459, "Asia"],        // Japon
  [460, 469, "Europa"],      // Rusia
  [470, 470, "Asia"],        // Kirguistan
  [471, 471, "Asia"],        // Taiwan
  [474, 474, "Europa"],      // Estonia
  [475, 475, "Europa"],      // Letonia
  [476, 476, "Asia"],        // Azerbaiyan
  [477, 477, "Europa"],      // Lituania
  [478, 478, "Asia"],        // Uzbekistan
  [479, 479, "Asia"],        // Sri Lanka
  [480, 480, "Asia"],        // Filipinas
  [481, 481, "Europa"],      // Bielorrusia
  [482, 482, "Europa"],      // Ucrania
  [483, 483, "Asia"],        // Turkmenistan
  [484, 484, "Europa"],      // Moldavia
  [485, 486, "Asia"],        // Armenia, Georgia
  [487, 488, "Asia"],        // Kazajistan, Tayikistan
  [489, 489, "Asia"],        // Hong Kong
  [490, 499, "Asia"],        // Japon
  [500, 509, "Europa"],      // Reino Unido
  [520, 521, "Europa"],      // Grecia
  [528, 528, "Asia"],        // Libano
  [529, 529, "Europa"],      // Chipre
  [530, 531, "Europa"],      // Albania, Macedonia del Norte
  [535, 535, "Europa"],      // Malta
  [539, 539, "Europa"],      // Irlanda
  [540, 549, "Europa"],      // Belgica y Luxemburgo
  [560, 560, "Europa"],      // Portugal
  [569, 569, "Europa"],      // Islandia
  [570, 579, "Europa"],      // Dinamarca
  [590, 590, "Europa"],      // Polonia
  [594, 594, "Europa"],      // Rumania
  [599, 599, "Europa"],      // Hungria
  [600, 601, "Africa"],      // Sudafrica
  [603, 609, "Africa"],
  [607, 607, "Asia"],        // Oman
  [608, 608, "Asia"],        // Bahrein
  [611, 620, "Africa"],
  [621, 621, "Asia"],        // Siria
  [622, 622, "Africa"],      // Egipto
  [624, 624, "Africa"],      // Libia
  [625, 630, "Asia"],        // Jordania..Qatar
  [631, 632, "Africa"],      // Namibia, Ruanda
  [640, 649, "Europa"],      // Finlandia
  [690, 699, "Asia"],        // China
  [700, 709, "Europa"],      // Noruega
  [729, 729, "Asia"],        // Israel
  [730, 739, "Europa"],      // Suecia
  [740, 759, "America"],     // Centroamerica y Mexico
  [760, 769, "Europa"],      // Suiza
  [770, 790, "America"],     // Sudamerica
  [800, 839, "Europa"],      // Italia
  [840, 849, "Europa"],      // España
  [850, 850, "America"],     // Cuba
  [858, 860, "Europa"],      // Eslovaquia, Chequia, Serbia
  [865, 865, "Asia"],        // Mongolia
  [867, 867, "Asia"],        // Corea del Norte
  [868, 869, "Asia"],        // Turquia
  [870, 879, "Europa"],      // Paises Bajos
  [880, 880, "Asia"],        // Corea del Sur
  [884, 884, "Asia"],        // Camboya
  [885, 885, "Asia"],        // Tailandia
  [888, 888, "Asia"],        // Singapur
  [890, 890, "Asia"],        // India
  [893, 893, "Asia"],        // Vietnam
  [896, 896, "Asia"],        // Pakistan
  [899, 899, "Asia"],        // Indonesia
  [900, 919, "Europa"],      // Austria
  [930, 939, "Oceania"],     // Australia
  [940, 949, "Oceania"],     // Nueva Zelanda
  [955, 955, "Asia"],        // Malasia
  [958, 958, "Asia"],        // Macao
];

export function getContinent(prefix3) {
  for (const [lo, hi, cont] of RANGES) {
    if (prefix3 >= lo && prefix3 <= hi) return cont;
  }
  // Fallback solo para prefijos verdaderamente no asignados/reservados.
  return CONTINENT_ORDER[prefix3 % 5];
}
