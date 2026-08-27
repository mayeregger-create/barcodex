// src/cardgen/traits/catalog.js
// Los 58 rasgos (doc §8.4-§8.6), transcriptos tal cual. `epiteto` siempre tiene forma m/f — los
// "invariables" del §12 (brutal, perforante, errante, inamovible, elusivo, vigia, estandarte,
// leal, baluarte, colosal, implacable, fulminante, paciente, atalaya, senorial, enjambre,
// prismatico, espejo, renaciente, legado, detonante, ancestral) repiten el mismo string en m y f,
// asi el codigo que consume esto nunca necesita ramificar por invariable/no-invariable.
export const TRAITS_COMUN = [
  { id: "blindado", tier: "comun", epiteto: { m: "Blindado", f: "Blindada" }, cm: 1.5, effect: "+1 al presupuesto de placas" },
  { id: "escamado", tier: "comun", epiteto: { m: "Escamado", f: "Escamada" }, cm: 1.5, effect: "Las placas rotas dejan un resto que sigue bloqueando Pierce" },
  { id: "remachado", tier: "comun", epiteto: { m: "Remachado", f: "Remachada" }, cm: 1.0, effect: "Una vez por partida, una placa rota se repone" },
  { id: "runico", tier: "comun", epiteto: { m: "Rúnico", f: "Rúnica" }, cm: 2.0, effect: "Sus placas tambien bloquean Magic" },
  { id: "coronado", tier: "comun", epiteto: { m: "Coronado", f: "Coronada" }, cm: 1.0, effect: "+2 Integridad de cabeza" },
  { id: "fibroso", tier: "comun", epiteto: { m: "Fibroso", f: "Fibrosa" }, cm: 1.5, effect: "+1 Integridad en brazos y piernas" },
  { id: "certero", tier: "comun", epiteto: { m: "Certero", f: "Certera" }, cm: 2.0, effect: "Pierce puede apuntar a zonas con placa, con la mitad del dano" },
  { id: "brutal", tier: "comun", epiteto: { m: "Brutal", f: "Brutal" }, cm: 2.0, effect: "Cut rompe la placa y ademas pasa 1 de dano" },
  { id: "sismico", tier: "comun", epiteto: { m: "Sísmico", f: "Sísmica" }, cm: 2.0, effect: "Blunt golpea 3 zonas contiguas en vez de 2" },
  { id: "perforante", tier: "comun", epiteto: { m: "Perforante", f: "Perforante" }, cm: 1.5, effect: "Ignora 1 punto de resistencia de cada placa" },
  { id: "carnicero", tier: "comun", epiteto: { m: "Carnicero", f: "Carnicera" }, cm: 1.5, effect: "+2 Fuerza contra zonas sin placa" },
  { id: "ejecutor", tier: "comun", epiteto: { m: "Ejecutor", f: "Ejecutora" }, cm: 1.5, effect: "+3 Fuerza contra zonas que ya esten en 1" },
  { id: "preciso", tier: "comun", epiteto: { m: "Preciso", f: "Precisa" }, cm: 1.5, effect: "Puede elegir la zona incluso usando Cut" },
  { id: "diestro", tier: "comun", epiteto: { m: "Diestro", f: "Diestra" }, cm: 1.0, effect: "Perder un brazo no reduce su Fuerza" },
  { id: "errante", tier: "comun", epiteto: { m: "Errante", f: "Errante" }, cm: 1.5, effect: "Movimiento 2 posiciones por accion" },
  { id: "inamovible", tier: "comun", epiteto: { m: "Inamovible", f: "Inamovible" }, cm: 1.0, effect: "No puede ser empujado ni arrastrado" },
  { id: "arrollador", tier: "comun", epiteto: { m: "Arrollador", f: "Arrolladora" }, cm: 1.5, effect: "Su ataque empuja al objetivo una posicion" },
  { id: "arponero", tier: "comun", epiteto: { m: "Arponero", f: "Arponera" }, cm: 1.5, effect: "Su ataque atrae al objetivo una posicion" },
  { id: "elusivo", tier: "comun", epiteto: { m: "Elusivo", f: "Elusivo" }, cm: 1.0, effect: "Al ser atacado, puede intercambiar posicion con un aliado adyacente" },
  { id: "anticipado", tier: "comun", epiteto: { m: "Anticipado", f: "Anticipada" }, cm: 1.5, effect: "Puede actuar la misma ronda en que se despliega" },
  { id: "reflejo", tier: "comun", epiteto: { m: "Reflejo", f: "Refleja" }, cm: 2.0, effect: "Si sobrevive a un ataque, contraataca una vez por ronda" },
  { id: "vigia", tier: "comun", epiteto: { m: "Vigía", f: "Vigía" }, cm: 1.5, effect: "Actua cuando un enemigo se despliega, fuera del orden normal" },
  { id: "estandarte", tier: "comun", epiteto: { m: "Estandarte", f: "Estandarte" }, cm: 2.0, effect: "Los aliados adyacentes ganan +1 Fuerza" },
  { id: "abastecedor", tier: "comun", epiteto: { m: "Abastecedor", f: "Abastecedora" }, cm: 1.0, effect: "Al desplegarse, otorga 1 Escombro a su bando" },
  { id: "leal", tier: "comun", epiteto: { m: "Leal", f: "Leal" }, cm: -1.0, effect: "Si el Regente es de su misma clase, Coste -2" },
];

export const TRAITS_RARO = [
  { id: "fortificado", tier: "raro", epiteto: { m: "Fortificado", f: "Fortificada" }, cm: 2.0, effect: "+2 al presupuesto de placas", counter: "Todas las zonas a 1 de Integridad" },
  { id: "baluarte", tier: "raro", epiteto: { m: "Baluarte", f: "Baluarte" }, cm: 2.0, effect: "+3 Integridad de torso, inmune al empuje", counter: "No puede moverse" },
  { id: "yelmo_sellado", tier: "raro", epiteto: { m: "Sellado", f: "Sellada" }, cm: 2.0, effect: "La cabeza es inmune a todo dano", counter: "No puede lanzar Magic" },
  { id: "templado", tier: "raro", epiteto: { m: "Templado", f: "Templada" }, cm: 1.5, effect: "Las placas tienen +1 de resistencia", counter: "Peso +1" },
  { id: "colosal", tier: "raro", epiteto: { m: "Colosal", f: "Colosal" }, cm: 2.5, effect: "+3 Fuerza", counter: "No actua la ronda en que se despliega" },
  { id: "gemelo", tier: "raro", epiteto: { m: "Gemelo", f: "Gemela" }, cm: 2.0, effect: "Ataca dos veces por accion", counter: "Cada golpe con la mitad de la Fuerza" },
  { id: "implacable", tier: "raro", epiteto: { m: "Implacable", f: "Implacable" }, cm: 3.0, effect: "Si su ataque rompe una zona, ataca otra vez", counter: "Una vez por ronda" },
  { id: "vengativo", tier: "raro", epiteto: { m: "Vengativo", f: "Vengativa" }, cm: 2.0, effect: "+1 Fuerza por cada zona propia rota", counter: "Empieza con -1 Fuerza" },
  { id: "devastador", tier: "raro", epiteto: { m: "Devastador", f: "Devastadora" }, cm: 2.5, effect: "Su dano se aplica a la zona y a la placa a la vez", counter: "Alcance -1" },
  { id: "fulminante", tier: "raro", epiteto: { m: "Fulminante", f: "Fulminante" }, cm: 3.0, effect: "Actua antes que cualquier otra unidad del tablero", counter: "Integridad de torso -1" },
  { id: "frenetico", tier: "raro", epiteto: { m: "Frenético", f: "Frenética" }, cm: 2.5, effect: "Actua dos veces por ronda", counter: "Cada accion con la mitad de la Fuerza" },
  { id: "paciente", tier: "raro", epiteto: { m: "Paciente", f: "Paciente" }, cm: 2.5, effect: "Cada ronda que no ataca, +2 Fuerza acumulativo", counter: "Actua siempre ultimo" },
  { id: "sereno", tier: "raro", epiteto: { m: "Sereno", f: "Serena" }, cm: 1.5, effect: "Al final de la ronda, si no ataco, repone 1 placa", counter: "Fuerza -1" },
  { id: "flanqueador", tier: "raro", epiteto: { m: "Flanqueador", f: "Flanqueadora" }, cm: 2.5, effect: "Puede actuar desde cualquier posicion", counter: "Integridad de torso -1" },
  { id: "avanzado", tier: "raro", epiteto: { m: "Avanzado", f: "Avanzada" }, cm: 1.5, effect: "Se despliega directamente en posicion 1", counter: "Solo puede estar en posicion 1" },
  { id: "atalaya", tier: "raro", epiteto: { m: "Atalaya", f: "Atalaya" }, cm: 2.0, effect: "Alcance +1", counter: "Solo puede estar en posicion 3" },
  { id: "escurridizo", tier: "raro", epiteto: { m: "Escurridizo", f: "Escurridiza" }, cm: 2.0, effect: "Al ser atacado por Pierce, se mueve y esquiva", counter: "Presupuesto de placas -1" },
  { id: "senorial", tier: "raro", epiteto: { m: "Señorial", f: "Señorial" }, cm: 2.0, effect: "Todas las estadisticas +1", counter: "Coste +2" },
  { id: "enjambre", tier: "raro", epiteto: { m: "Enjambre", f: "Enjambre" }, cm: 2.5, effect: "Se despliega como dos copias", counter: "Cada copia con la mitad de la Integridad" },
  { id: "heredero", tier: "raro", epiteto: { m: "Heredero", f: "Heredera" }, cm: 2.0, effect: "Si el Regente cae, ocupa su lugar con la habilidad del Nucleo", counter: "No puede ser investido" },
];

export const TRAITS_LEGENDARIO = [
  { id: "trimano", tier: "legendario", epiteto: { m: "Trímano", f: "Trímana" }, cm: 4.0, effect: "Tres brazos. Un brazo secundario adicional con su beneficio completo" },
  { id: "bicefalo", tier: "legendario", epiteto: { m: "Bicéfalo", f: "Bicéfala" }, cm: 4.0, effect: "Dos cabezas. Conserva la pasiva mientras quede una. Doble reserva para Magic" },
  { id: "prismatico", tier: "legendario", epiteto: { m: "Prismático", f: "Prismático" }, cm: 4.5, effect: "Puede usar los cuatro tipos de dano, cada uno con la mitad de la Fuerza" },
  { id: "espejo", tier: "legendario", epiteto: { m: "Espejo", f: "Espejo" }, cm: 3.5, effect: "Copia el rasgo de la unidad enemiga que tenga enfrente" },
  { id: "indomito", tier: "legendario", epiteto: { m: "Indómito", f: "Indómita" }, cm: 3.0, effect: "La primera zona que llegaria a 0 queda en 1. Una vez por partida" },
  { id: "estoico", tier: "legendario", epiteto: { m: "Estoico", f: "Estoica" }, cm: 3.5, effect: "Nunca colapsa. Sigue bloqueando su posicion" },
  { id: "renaciente", tier: "legendario", epiteto: { m: "Renaciente", f: "Renaciente" }, cm: 4.0, effect: "Al colapsar, vuelve a la mano de su dueno" },
  { id: "legado", tier: "legendario", epiteto: { m: "Legado", f: "Legado" }, cm: 2.5, effect: "Al colapsar, deja 3 Escombros en vez de 1" },
  { id: "detonante", tier: "legendario", epiteto: { m: "Detonante", f: "Detonante" }, cm: 3.0, effect: "Al colapsar, 2 de dano al torso de las unidades adyacentes" },
  { id: "palindromo", tier: "legendario", epiteto: { m: "Palíndromo", f: "Palíndroma" }, cm: 3.5, effect: "Solo en codigos capicua. Inmune al primer ataque de cada ronda" },
  { id: "igneo", tier: "legendario", epiteto: { m: "Ígneo", f: "Ígnea" }, cm: 3.5, effect: "Su dano se propaga: 1 punto a la misma zona de la unidad de atras" },
  { id: "ancestral", tier: "legendario", epiteto: { m: "Ancestral", f: "Ancestral" }, cm: 5.0, effect: "Recibe el rasgo base de los cinco linajes a la vez", requiresPlaytest: true },
  { id: "anomalo", tier: "legendario", epiteto: { m: "Anómalo", f: "Anómala" }, cm: 4.5, effect: "Recibe dos rasgos adicionales en vez de uno", requiresPlaytest: true },
];

export const ALL_TRAITS = [...TRAITS_COMUN, ...TRAITS_RARO, ...TRAITS_LEGENDARIO];
export const TRAITS_BY_ID = new Map(ALL_TRAITS.map((t) => [t.id, t]));
export const TRAITS_BY_TIER = { comun: TRAITS_COMUN, raro: TRAITS_RARO, legendario: TRAITS_LEGENDARIO };
