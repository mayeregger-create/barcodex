// src/cardgen/names.js
// Pool fonetico por linaje (canal 9). Doc §12 pide 200 nombres por linaje (1000 en total) con
// genero declarado — eso esta marcado como "requiere datos externos" (§17), asi que esto es un
// SET INICIAL de 10+10 por linaje (100 en total), suficiente para que el generador corra de punta
// a punta y se pueda verificar, pero mucho mas chico que el objetivo final. Ampliar esta lista no
// rompe ninguna carta ya generada en un linaje que no se toco; ampliar la de UN linaje si cambia
// que nombre le toca a cada codigo de ESE linaje (el indice del canal9 se recalcula sobre un pool
// mas largo) — avisar antes de tocar esto en produccion.
export const NAME_POOLS = {
  // Consonantes duras, silabas cerradas.
  prensa: [
    { name: "Bran", gender: "m" }, { name: "Kort", gender: "m" }, { name: "Dresk", gender: "m" },
    { name: "Gorn", gender: "m" }, { name: "Thal", gender: "m" }, { name: "Brok", gender: "m" },
    { name: "Vand", gender: "m" }, { name: "Krum", gender: "m" }, { name: "Dask", gender: "m" }, { name: "Morg", gender: "m" },
    { name: "Brenn", gender: "f" }, { name: "Korda", gender: "f" }, { name: "Vaska", gender: "f" },
    { name: "Dreska", gender: "f" }, { name: "Morna", gender: "f" }, { name: "Gralda", gender: "f" },
    { name: "Threka", gender: "f" }, { name: "Vanda", gender: "f" }, { name: "Kalda", gender: "f" }, { name: "Skarn", gender: "f" },
  ],
  // Silabas abiertas, vocales agudas.
  fundicion: [
    { name: "Kaito", gender: "m" }, { name: "Rio", gender: "m" }, { name: "Seno", gender: "m" },
    { name: "Taro", gender: "m" }, { name: "Kei", gender: "m" }, { name: "Yato", gender: "m" },
    { name: "Riko", gender: "m" }, { name: "Sami", gender: "m" }, { name: "Teo", gender: "m" }, { name: "Kano", gender: "m" },
    { name: "Mika", gender: "f" }, { name: "Aiko", gender: "f" }, { name: "Nari", gender: "f" },
    { name: "Seka", gender: "f" }, { name: "Rina", gender: "f" }, { name: "Kimi", gender: "f" },
    { name: "Sora", gender: "f" }, { name: "Yumi", gender: "f" }, { name: "Emi", gender: "f" }, { name: "Kira", gender: "f" },
  ],
  // Vocales abiertas, sonidos guturales.
  cantera: [
    { name: "Khoro", gender: "m" }, { name: "Baraq", gender: "m" }, { name: "Achak", gender: "m" },
    { name: "Ogun", gender: "m" }, { name: "Zuhal", gender: "m" }, { name: "Karo", gender: "m" },
    { name: "Ahado", gender: "m" }, { name: "Baruk", gender: "m" }, { name: "Chaka", gender: "m" }, { name: "Qoro", gender: "m" },
    { name: "Amara", gender: "f" }, { name: "Kaya", gender: "f" }, { name: "Zahra", gender: "f" },
    { name: "Ochi", gender: "f" }, { name: "Halima", gender: "f" }, { name: "Ekwa", gender: "f" },
    { name: "Nuru", gender: "f" }, { name: "Aisha", gender: "f" }, { name: "Zola", gender: "f" }, { name: "Tabu", gender: "f" },
  ],
  // Liquidas y vocales largas.
  marea: [
    { name: "Loran", gender: "m" }, { name: "Ailel", gender: "m" }, { name: "Ouren", gender: "m" },
    { name: "Selir", gender: "m" }, { name: "Ranael", gender: "m" }, { name: "Lior", gender: "m" },
    { name: "Ael", gender: "m" }, { name: "Rael", gender: "m" }, { name: "Lune", gender: "m" }, { name: "Auren", gender: "m" },
    { name: "Lira", gender: "f" }, { name: "Aeli", gender: "f" }, { name: "Selune", gender: "f" },
    { name: "Ora", gender: "f" }, { name: "Lael", gender: "f" }, { name: "Iren", gender: "f" },
    { name: "Alua", gender: "f" }, { name: "Miren", gender: "f" }, { name: "Yalu", gender: "f" }, { name: "Elin", gender: "f" },
  ],
  // Nasales y silabas mixtas.
  injerto: [
    { name: "Nando", gender: "m" }, { name: "Manu", gender: "m" }, { name: "Neco", gender: "m" },
    { name: "Aminto", gender: "m" }, { name: "Renzo", gender: "m" }, { name: "Nino", gender: "m" },
    { name: "Camo", gender: "m" }, { name: "Anael", gender: "m" }, { name: "Tomen", gender: "m" }, { name: "Nunzio", gender: "m" },
    { name: "Mona", gender: "f" }, { name: "Nina", gender: "f" }, { name: "Ines", gender: "f" },
    { name: "Nayara", gender: "f" }, { name: "Amira", gender: "f" }, { name: "Mira", gender: "f" },
    { name: "Nena", gender: "f" }, { name: "Yamin", gender: "f" }, { name: "Ninon", gender: "f" }, { name: "Manina", gender: "f" },
  ],
};

export function nameFromRoll(linaje, roll) {
  const pool = NAME_POOLS[linaje];
  const idx = Math.min(pool.length - 1, Math.floor(roll * pool.length));
  return pool[idx];
}

const CLASS_DISPLAY = {
  warrior: "Warrior", paladin: "Paladin", rogue: "Rogue",
  ranger: "Ranger", templar: "Templar", sentinel: "Sentinel",
};

export function displayName(name, clase, epitetoText) {
  return `${name}, ${CLASS_DISPLAY[clase]} ${epitetoText}`;
}
