# BarCodex — Documento de diseño

## 1. Concepto

Al escanear el código de barras de cualquier producto real, el sistema genera un personaje jugable a partir de los 13 dígitos del código (EAN-13). Los atributos, la clase, el elemento, el sexo y la habilidad especial del personaje se derivan matemáticamente del código, con reglas simplificadas tipo D&D. El gancho del juego es el azar controlado: no sabés qué te va a tocar hasta que escaneás, lo que incentiva seguir probando productos distintos.

**Nombre elegido: BarCodex** — portmanteau de "barcode" + "codex", comunica de una que el juego es una colección de criaturas sacadas de códigos reales.

Formato para el MVP: **duelos por turnos de escuadrones de 3 personajes**, en el orden en que fueron asignados, con reemplazo automático cuando un personaje cae.

---

## 2. Generación del personaje — los 7 lentes + sexo

Cada estadística se calcula con una operación distinta sobre los 13 dígitos del código (D1 a D13), para que no queden correlacionadas entre sí.

| Estadística | Fórmula |
|---|---|
| **Fuerza** | Suma de dígitos en posiciones impares (D1+D3+D5+D7+D9+D11+D13), `mod 20 + 1` |
| **Velocidad** | Suma de dígitos en posiciones pares (D2+D4+D6+D8+D10+D12), `mod 20 + 1` |
| **Defensa** | Suma de productos de tríos consecutivos (D1×D2×D3 + D4×D5×D6 + D7×D8×D9 + D10×D11×D12), `mod 20 + 1`. Los ceros en un trío anulan ese producto — genera "puntos ciegos" de Defensa naturales en ciertos códigos |
| **Energía** | Valor absoluto de (suma de la 1ª mitad − suma de la 2ª mitad), `mod 20 + 1` |
| **Suerte** | Base 10 + 5 por cada par de dígitos consecutivos repetidos. Puede romper el techo de 20 (ver sección 2.2) |
| **Elemento** | Prefijo GS1 real (primeros 2–3 dígitos) → país → continente (ver sección 3) |
| **Habilidad especial** | El dígito verificador D13 (checksum matemático de todo el resto del código) indexa una tabla de 10 habilidades (ver sección 5) |
| **Sexo** | Suma de los primeros 12 dígitos (sin el verificador), `mod 2`. Par → Masculino, impar → Femenino (ver sección 2.3) |

La clase del personaje sale de la estadística dominante (ver sección 4). En caso de empate, se usa el orden de prioridad: Fuerza > Velocidad > Defensa > Energía > Suerte.

### 2.1 Sistema de ítems (desde ISBN)

Los códigos que arrancan con 978–979 (ISBN, libros) no generan un personaje: generan un **ítem**. El sistema completo tiene **6 categorías**, cada una con su propia fuente numérica dentro del ISBN.

**Chequeo de Reliquia primero**: si el código tiene 3 o más pares de dígitos consecutivos repetidos, no sigue el flujo normal — genera una **Reliquia** (categoría aparte, ver más abajo). Esto pasa en, aproximadamente, el 10% de los escaneos. Si no cumple esa condición, la categoría sale de `suma dígitos 4–9, mod 5`.

**Regla de balance**: para que los ítems se sientan sin volverse determinantes, las magnitudes numéricas usan `mod 5 + 1` (rango 1–5, no 1–10 como en una versión anterior) — como mucho un 25% de una stat, no el 50%. Todos los bonus respetan el tope de 20, igual que el resto del sistema.

| Categoría | Alcance | Cómo se calcula |
|---|---|---|
| **Elixir** | 1 personaje, temporal | Duración: dígito 10 `mod 3 + 1` (1 a 3 combates). Stat: D13 `mod 5`. Magnitud: dígitos 11–12 `mod 5 + 1` |
| **Arma** | 1 personaje, permanente | Tipo de arma = D13 `mod 5` (Fuerza→espada, Velocidad→daga, Defensa→escudo, Energía→bastón, Suerte→cartas — cada una afín a una clase). Magnitud: dígitos 11–12 `mod 5 + 1`. **Si se equipa en la clase afín, +2 flat** (no duplica) |
| **Libro** | Escuadrón completo | D13 `mod 8` indexa una lista de 8 efectos (ver abajo) |
| **Armadura/Casco** | 1 personaje, permanente | Siempre Defensa. Subtipo: dígito 9 `mod 2` (Armadura/Casco). Magnitud: dígitos 11–12 `mod 5 + 1` |
| **Accesorio** | 1 personaje, permanente | D13 `mod 6` indexa una lista de 6 mitigaciones parciales (ver abajo) |
| **Reliquia** | Variable según cuál | D13 `mod 6` indexa una lista de 6 reglas únicas, sin número de magnitud |

Se puede tener hasta **3 ítems activos a la vez**; para agregar un 4to hay que quitar uno existente (pantalla de gestión de ítems, sección 11).

#### Libros (efecto para todo el escuadrón)

| # | Efecto |
|---|---|
| 0 | Al conectar un crítico, todo el escuadrón gana +1 Energía |
| 1 | Al bloquear con Parry exitosamente, 20% de aturdir al rival 1 turno |
| 2 | Al entrar por reemplazo automático, cura 10% de HP máximo al entrar |
| 3 | Cada 3 turnos, el activo regenera 1 Energía extra |
| 4 | Al usar habilidad especial, 15% de no gastar Energía |
| 5 | Al recibir un crítico enemigo, 25% de que se resuelva como golpe normal |
| 6 | Al ganar ventaja de rivalidad elemental, +5% de crítico ese turno |
| 7 | El primer crítico fallido del combate (de cualquiera) se vuelve a tirar una vez |

#### Accesorios (mitigación parcial, no inmunidad total)

| # | Efecto |
|---|---|
| 0 | 50% de resistir parálisis/stun |
| 1 | 40% de que un crítico enemigo se resuelva como golpe normal |
| 2 | La penalización de rival elemental se reduce a la mitad |
| 3 | 50% de resistir "pierde el turno" |
| 4 | Drenaje enemigo rinde la mitad contra este personaje |
| 5 | Inmune al primer debuff del combate (una vez por combate) |

#### Reliquias (reglas únicas, sin magnitud numérica)

| # | Nombre | Alcance | Efecto |
|---|---|---|---|
| 0 | Espejo roto | 1 personaje | 20% de que una habilidad especial enemiga también afecte a quien la lanzó |
| 1 | Reloj de arena | 1 personaje, un solo uso | Actúa una vez más antes del turno rival, sin importar Velocidad |
| 2 | Semilla de intercambio | Escuadrón completo | El que entra por reemplazo hereda 25% de la Energía del caído |
| 3 | Brújula rota | 1 personaje | El combate contra el activo enemigo se resuelve siempre como "mismo continente" (neutro) |
| 4 | Vela consumida | 1 personaje, un solo uso | Cura HP = 2× la Energía actual, y pone la Energía en 0 |
| 5 | Dado cargado | Escuadrón completo, 1 vez por combate | El primer crítico fallido del combate se vuelve a tirar |

Las Reliquias no tienen lente de magnitud a propósito: no salen "más fuertes" en una tirada que en otra — la variabilidad está en *cuál* te toca, no en *cuánto* suma. Es la misma filosofía de balance que los Libros y Accesorios, ninguno de los tres toca directamente los 5 stats con un número grande.

#### Ejemplo: cómo interactúan con personajes reales

Usando 6 ítems generados de verdad con las fórmulas de arriba, aplicados a los personajes de ejemplo de la sección 12:

| Ítem generado | Categoría | Personaje receptor | Interacción con stats |
|---|---|---|---|
| Elixir de Fuerza +3 (1 combate) | Elixir | Mago · Asia | Fuerza 4 → **7** (suma limpia, sin tocar el tope) |
| Daga, magnitud 2 (+2 por afinidad = 4) | Arma | Pícaro · América | Velocidad 19 → **20** (el tope de 20 absorbe parte del bonus: de +4 solo se aplica +1 efectivo) |
| Casco, magnitud 4 | Armadura/Casco | Bardo · África | Defensa 7 → **11** (sube HP máximo indirectamente, sin regla extra) |
| Libro #0 — crítico da +1 Energía al escuadrón | Libro | Escuadrón completo | No modifica ninguna stat base — es un disparador que solo actúa durante el combate |
| Accesorio #1 — 40% crítico enemigo → normal | Accesorio | 1 personaje a elección | No modifica stats base — mitiga un resultado de combate, no suma números |
| Reliquia — Semilla de intercambio | Reliquia | Escuadrón completo | No modifica stats base — efecto condicional que solo se activa cuando entra un reemplazo |

La fila de la Daga es la más importante de leer: es el caso real donde el tope de 20 protege el balance — aunque el ítem "debería" dar +4, el personaje ya estaba en 19, así que en la práctica el bonus efectivo fue de +1. Y las últimas tres filas muestran algo clave del diseño: la mitad de las categorías de ítems **no tocan los números crudos en absoluto** — actúan como reglas que se activan en momentos puntuales del combate, que es justamente lo que evita que un ítem se sienta tan determinante como el propio código de barras del personaje.

### 2.2 Suerte rompiendo la escala

Si `Suerte_base = 10 + 5×repeticiones` supera 20, Suerte queda topeada en 20 y el excedente se reparte de a 1 punto en el ciclo fijo **Fuerza → Velocidad → Defensa → Energía**, empezando en la stat que indique `D13 mod 4` (determinístico). Si al repartir un punto una stat también llega a su tope de 20, ese punto sigue circulando al siguiente en el ciclo — en códigos extremos esto puede maximizar varias stats a la vez, lo cual está bien: sería el equivalente a un personaje "roto" que la comunidad va a cazar a propósito.

### 2.3 Sexo del personaje y su bonus

El sexo aplica un bonus de +2 nominal a un par de stats, con prioridad según la clase del personaje. Se determina con la suma de los **primeros 12 dígitos del código, sin incluir el dígito verificador (D13)**, `mod 2`:

- Par → **Masculino** → par candidato {Fuerza, Defensa}
- Impar → **Femenino** → par candidato {Energía, Velocidad}

*Nota técnica: no se puede usar la suma de los 13 dígitos completos, porque la propiedad matemática del dígito verificador de EAN-13 obliga a que esa suma total sea siempre par — daría Masculino el 100% de las veces. Usando solo los primeros 12 dígitos (que sí son libres), la paridad queda genuinamente 50/50.*

Dentro del par, se define una **primaria** y una **secundaria**:
- Si la stat de la clase del personaje está en el par, esa es la primaria (sin importar el orden por defecto).
- Si la clase no tiene relación con el par (ej. Bardo, o combinaciones cruzadas), se usa el orden por defecto: Fuerza antes que Defensa en Masculino, Energía antes que Velocidad en Femenino.

Los 4 puntos de bonus (+2 a cada stat del par) se asignan así: primero a la primaria hasta su tope de 20; si sobra porque ya estaba cerca del tope, el sobrante pasa a la secundaria; si la secundaria también topea, ahí se pierde.

| Clase (stat) | Masculino — primaria / secundaria | Femenino — primaria / secundaria |
|---|---|---|
| Guerrero (Fuerza) | **Fuerza** / Defensa | Energía / Velocidad *(orden default)* |
| Pícaro (Velocidad) | Fuerza / Defensa *(orden default)* | **Velocidad** / Energía |
| Tanque (Defensa) | **Defensa** / Fuerza | Energía / Velocidad *(orden default)* |
| Mago (Energía) | Fuerza / Defensa *(orden default)* | **Energía** / Velocidad |
| Bardo (Suerte) | Fuerza / Defensa *(orden default)* | Energía / Velocidad *(orden default)* |

Ejemplo: un Mago Femenino con Energía en 19 antes del bonus → sube 1 (llega a 20, el tope) y el punto sobrante (de los 2 nominales) pasa a Velocidad, que termina con +3 en vez de +2.

---

## 3. Elemento por continente (prefijos GS1 reales)

| Continente | Rango de prefijos (ejemplos) | Trait distintivo |
|---|---|---|
| América | 000–139 (EE. UU./Canadá), 740–790 (Centro/Sudamérica), 850 (Cuba) | Adaptable — bonus extra a la estadística que ya sea más alta |
| Europa | 300–599, 700–739, 760–919 | Erudito — bonus fijo a Energía |
| Asia | 450–499 (Japón), 680–699 (China), 850–899 (Corea, India, Vietnam, Indonesia...) | Disciplina — bonus fijo a Defensa |
| África | 600–632 | Resiliencia — bonus fijo a Fuerza |
| Oceanía | 930–949 (Australia, Nueva Zelanda) | **Endémico** — bonus a la estadística *más baja* del personaje (al revés de América) |

El trait de Oceanía compensa lo injusto que sería sacar un personaje rarísimo (por caer en un rango de prefijos tan chico) que encima tenga un punto débil enorme, y genera una simetría temática con el trait de América.

Nota de lore: el prefijo GS1 indica el gremio/país donde la empresa se registró, no dónde se fabricó el producto. Se puede usar narrativamente ("el elemento representa a qué corona juró lealtad la compañía").

**Nota de implementación**: el motor cubre los rangos GS1 oficialmente asignados país por país (todos los de Latinoamérica individualmente, el bloque europeo completo, el asiático, etc.), no solo los 5 rangos grandes de la tabla de arriba. El fallback por módulo (usado antes para cualquier prefijo no cubierto) quedó reservado solo para códigos verdaderamente no asignados, que en la práctica casi no aparecen.

---

## 4. Las 5 clases básicas

| Estadística dominante | Clase | Pasivo de combate | Silueta de combate |
|---|---|---|---|
| Fuerza | Guerrero | +10% de daño en ataques básicos | Espada grande |
| Velocidad | Pícaro | Gana los empates de Velocidad automáticamente | Dagas gemelas |
| Defensa | Tanque | −15% de daño recibido adicional | Escudo |
| Energía | Mago | Recupera Energía extra al usar Parry (ver sección 6) | Bastón / orbe |
| Suerte | Bardo | Probabilidad de crítico duplicada | Dados / cartas |

Cada clase tiene su propia silueta distintiva en pantalla de combate, en vez de un cuerpo genérico recoloreado.

---

## 5. Las 10 habilidades especiales (por dígito verificador D13)

| Dígito | Habilidad | Efecto | Tipo |
|---|---|---|---|
| 0 | Golpe veloz | Ataca dos veces con daño reducido cada golpe | Ofensiva |
| 1 | Golpe certero | No puede fallar; bonus si Velocidad > rival | Ofensiva |
| 2 | Piel de corteza | Reduce el daño recibido a la mitad este turno | Defensiva |
| 3 | Drenaje | Parte del daño causado se convierte en Energía propia | Utilidad |
| 4 | Grito de guerra | Sube la Fuerza de forma permanente en el combate | Buff |
| 5 | Paso fantasma | Esquiva automáticamente el próximo ataque | Defensiva |
| 6 | Fortuna del mercader | 50% doble daño / 50% pierde el turno | Riesgo (Suerte) |
| 7 | Regeneración | Recupera HP durante varios turnos | Sostenida |
| 8 | Grito paralizante | El rival pierde su próxima acción | Control |
| 9 | Golpe definitivo | Daño masivo, gasta toda la Energía | Ofensiva (todo o nada) |

La rareza visual del personaje (común/raro/épico) es un sistema aparte, ligado a patrones repetidos en el código — no está atada a qué tan poderosa es la habilidad.

---

## 6. La rueda elemental (estilo Magic: The Gathering)

Los 5 continentes se ubican en un pentágono. **Vecinos = afines, cruzados en la estrella interior = rivales.** No hay direccionalidad ("quién le gana a quién"), es una relación simétrica.

- **Afines**: América–Oceanía, Oceanía–Europa, Europa–Asia, Asia–África, África–América
- **Rivales**: América–Europa, América–Asia, Oceanía–Asia, Oceanía–África, Europa–África

### Efecto en combate (aplica a cualquier par: aliados en el mismo escuadrón o rivales en duelo)

| Relación | Efecto |
|---|---|
| Afines | −15% de daño mutuo, +1 Energía extra por turno para ambos |
| Rivales | +25% de daño mutuo |
| Mismo continente | Neutro, sin modificador |

---

## 7. Escuadrones de 3 personajes

El primer personaje elegido es el **principal**. Existen 6 tipos posibles según la composición:

| # | Composición | Nombre | Pares internos | Efecto agregado |
|---|---|---|---|---|
| 1 | Principal + 2 afines | Bastión | afín, afín, rival | Principal: +2 Energía/turno, sin penalización. Flancos: +1 Energía, +15% crítico / −10% Defensa |
| 2 | Principal + 1 afín + 1 rival | Mixto | afín, rival, (variable) | Principal: +1 Energía, +15% crítico / −10% Defensa. El 3er par decide si se parece más a Bastión o a Vanguardia |
| 3 | Principal + 2 rivales | Vanguardia | rival, rival, afín | Principal: +30% crítico / −20% Defensa, sin Energía extra. Flancos: +15% crítico / −10% Defensa, +1 Energía |
| 4 | 2 del mismo continente + 1 afín | Núcleo (batería) | mismo, afín, afín | Los 2 iguales: +10% resistencia + 1 Energía c/u. El afín: +2 Energía/turno |
| 5 | 2 del mismo continente + 1 rival | Núcleo (presión) | mismo, rival, rival | Los 2 iguales: +10% resistencia + 15% crítico/−10% Defensa c/u. El rival: +30% crítico / −20% Defensa |
| 6 | 3 del mismo continente | Monobloque | mismo, mismo, mismo | Los 3: +20% resistencia a ese elemento. Sin Energía ni crítico extra |

Nota matemática: con solo 5 continentes en pentágono, elegir 3 nodos distintos solo tiene 2 formas geométricas posibles (tripleta consecutiva o tripleta con salto). El "Mixto" no es una tercera forma nueva — según el afín y el rival elegidos, termina pareciéndose por dentro a un Bastión o a una Vanguardia. El motor de juego no necesita reglas especiales por tipo: solo calcula la relación de cada uno de los 3 pares y suma los efectos de la tabla de la sección 6.

---

## 8. Mecánica de combate

- **Formato**: 3 contra 3, orden fijo asignado al armar el escuadrón. Sin cambio voluntario — cuando el personaje activo cae, entra automáticamente el siguiente. Gana quien deje al equipo rival sin sus 3 personajes primero.
- **Orden de turno**: ataca primero quien tenga más Velocidad. Empate → decide Suerte (o el pasivo de Pícaro).
- **Acciones por turno**: Atacar / Usar habilidad especial (cuesta Energía) / **Parry** (ver 8.1).
- **Daño básico**: `Fuerza del atacante − (Defensa del objetivo ÷ 2)`, mínimo 1.
- **HP total**: `(Fuerza + Defensa) × 2 + 20`.
- **Crítico**: probabilidad ligada a Suerte, golpe por 1.5x daño.
- El modificador de la rueda elemental (sección 6) se aplica sobre el daño final de cada golpe entre los dos personajes activos enfrentados.
- **Stats inspeccionables**: durante el combate se puede tocar el ícono/silueta de cualquier personaje activo para ver sus 5 stats crudas (Fuerza, Velocidad, Defensa, Energía, Suerte), no solo el resultado ya calculado.

### 8.1 Parry (reemplaza a "Defender")

Defender (mitad de daño a cambio de perder el turno) era una opción dominada: perder daño garantizado sin nada a cambio seguía siendo pérdida neta. Parry lo reemplaza con una apuesta real:

Al bloquear, hay una probabilidad de éxito según la clase. Si sale bien: cero daño recibido + se refleja un % del daño bloqueado al rival. Si falla: se recibe el golpe completo.

| Clase | Probabilidad de bloqueo | % reflejado | Nota |
|---|---|---|---|
| Guerrero | 50% | 50% | Equilibrado |
| Tanque | 70% | 30% | Bloquea casi siempre, devuelve poco |
| Pícaro | 35% | 70% | Arriesgado, letal cuando conecta |
| Mago | 40% | 40% (como Energía, no daño) | El reflejo carga Energía en vez de dañar |
| Bardo | Igual a su % de Suerte actual | Aleatorio 20–80% | El más impredecible, coherente con su identidad |

Cruce con la rueda elemental: contra un **rival**, +10% de probabilidad de bloqueo. Contra un **afín**, el bloqueo exitoso da +1 Energía extra en vez de reflejo de daño.

---

## 9. Progresión

Cada cierta cantidad de victorias (base: 3) se habilita **un escaneo nuevo a elección** — el jugador decide en el momento si escanea un código de producto normal (nuevo personaje) o un ISBN (ítem de escuadrón / buff temporal).

---

## 10. Formatos de juego considerados

Se evaluaron 5 formatos posibles; el elegido para el MVP es el **#1**, expandido a escuadrones de 3.

1. **Duelos 1v1 por turnos** (elegido, expandido a 3v3) — el más directo para validar el balance de stats.
2. **Escuadrón / auto-battler** — recompensa variedad de productos escaneados.
3. **Roguelike de despensa** — cada piso pide un escaneo nuevo en tiempo real; ideal para sesiones cortas.
4. **PvP asíncrono / liga social** — el de mayor potencial viral, pero requiere más infraestructura.
5. **Colección/fusión sandbox** — sin combate, foco en catalogar y fusionar; ideal para público casual.

---

## 11. Pantallas del MVP

Loop cerrado de 6 pantallas, sin depender de nada externo:

1. **Inicio / Escaneo** — CTA principal de escanear (o input manual de 12 dígitos + cálculo automático del dígito verificador en la versión prototipo).
2. **Revelación de personaje** — la pantalla más importante: muestra la ilustración, clase, elemento, sexo, stats y habilidad recién generados.
3. **Colección** — grid tipo Pokédex de los personajes ya escaneados, con espacios vacíos como incentivo a seguir escaneando.
4. **Armado de equipo** — selección de 3 personajes de la colección; muestra en vivo el tipo de escuadrón (de los 6 de la sección 7) y los buffs resultantes.
5. **Combate** — duelo 3v3 por turnos; incluye la rueda elemental entre los dos personajes activos, sus siluetas (diferenciadas por clase), buffs, habilidades, Parry y stats inspeccionables.
6. **Victoria / Derrota** — recompensas y progreso hacia el próximo escaneo en la victoria; tono no punitivo en la derrota (no se pierde nada de la colección), con un tip táctico sobre por qué se perdió.

**Pantalla adicional ya diseñada**: Gestión de ítems de escuadrón — hasta 3 slots activos, inventario de ítems escaneados desde ISBN, equipar/quitar con reemplazo manual al llegar al límite.

Pendiente para una segunda etapa (no bloqueante para el MVP):
- Perfil / ajustes

---

## 12. Representación visual — sistema de prompt jerarquizado

Objetivo: que dos jugadores que escaneen el mismo código obtengan la misma imagen (o casi), y que todos los personajes se sientan parte del mismo juego pese a tener stats muy distintas.

**Herramienta recomendada**: [Pollinations.ai](https://pollinations.ai) — API gratuita, sin necesidad de cuenta, generación vía URL con parámetro `seed` para reproducibilidad. El seed se fija como el propio código de barras (`seed = parseInt(codigo_13_digitos)`), así el mismo producto siempre genera el mismo prompt + el mismo seed.

**Estilo general**: anime dinámico apto para público adolescente. Ambos sexos con la misma energía de acción (poses dinámicas, sin desnudos ni encuadres sexualizados). **La cantidad de piel expuesta la define la Defensa (armadura), no el sexo del personaje** — a igual Defensa, igual cobertura, sin importar si el personaje es masculino o femenino.

### 12.1 Jerarquía del prompt (orden de mayor a menor peso)

1. Clase (silueta y pose base)
2. Sexo (tipo de cuerpo, sin relación con nivel de cobertura)
3. Elemento/continente (paleta de colores + motivo temático)
4. Rareza (calidad de los materiales/acabados)
5. Nivel de armadura según Defensa (cobertura física)
6. Stat dominante (adjetivo físico que la refuerza)
7. Habilidad especial (prop/efecto visual)
8. Sufijo de estilo fijo — constante en todos los personajes, es lo que da unidad visual al juego

### 12.2 Nivel de armadura por Defensa (igual para ambos sexos)

| Defensa | Cobertura | Descripción visual |
|---|---|---|
| 1–6 | Mínima | Ropa de calle/entrenamiento, brazos y piernas descubiertos |
| 7–12 | Parcial | Cuero liviano, chaleco corto, cintura y hombros descubiertos |
| 13–17 | Sustancial | Placas parciales sobre tela gruesa, solo rostro y manos descubiertas |
| 18–20 | Total | Armadura pesada completa, casco o visor |

### 12.3 Motivo por continente

| Continente | Paleta | Motivo temático |
|---|---|---|
| América | Coral, rojo cálido, dorado | Patrones geométricos andinos, plumas estilizadas |
| Europa | Violeta, azul profundo, plata | Runas grabadas, capas largas, ornamentos tipo vitral |
| Asia | Verde azulado, negro, bordes dorados | Caligrafía en tinta, fajas ceremoniales, tela fluida |
| África | Ámbar, terracota, marrón cálido | Patrones tribales geométricos, madera tallada |
| Oceanía | Turquesa, coral claro, blanco arena | Motivos de olas/coral, tatuajes tribales polinesios |

### 12.4 Prop visual por habilidad especial

Los efectos van pegados al cuerpo o al arma del personaje, no dispersos por la escena — el objetivo es que el entorno se mantenga limpio y el foco sea el personaje, no un festival de objetos flotando.

| Habilidad | Prop / efecto visual |
|---|---|
| Golpe veloz | Una sola imagen residual (afterimage) pegada a la silueta |
| Golpe certero | Mira pequeña sobre el arma |
| Piel de corteza | Grietas tipo corteza iluminándose sobre piel/armadura |
| Drenaje | Un hilo fino de energía púrpura hacia el objetivo |
| Grito de guerra | Contorno de aura roja sutil, grietas pequeñas bajo los pies |
| Paso fantasma | Silueta semitransparente con una sola estela azul |
| Fortuna del mercader | Unas pocas monedas junto a la mano, brillo dorado tenue |
| Regeneración | Brillo verde suave alrededor de las manos |
| Grito paralizante | Un solo anillo de onda de choque |
| Golpe definitivo | Energía concentrada de forma compacta en el arma |

### 12.5 Composición y fondo

Directiva fija agregada al final de todo prompt: **fondo limpio y minimalista, sin objetos flotando de más, composición ordenada, un solo personaje como foco**. Esto evita que combinaciones de clase + stat alta + habilidad (por ejemplo un Bardo con Suerte alta usando Fortuna del mercader) apilen tres efectos "flotantes" distintos y saturen la imagen.

---

## 13. Decisiones pendientes

- Aplicar el fix del botón "Confirmar escuadrón" la próxima vez que se reconstruya esa pantalla (el snippet corregido ya está listo, sección 7).
- Balance: correr simulaciones automáticas en volumen (no partida por partida) para detectar si algún tipo de escuadrón o combinación de ítems gana sistemáticamente de más.
- Playtesting con productos reales de una casa, no solo códigos generados al azar.
- Salto a un prototipo jugable fuera del chat (la lógica ya está probada; falta la implementación real).
