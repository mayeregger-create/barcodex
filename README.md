# BarCodex — starter de lógica de juego

Este paquete NO es una app terminada. Es el **motor de reglas ya probado y verificado**
(generación de personajes, escuadrones, combate, ítems) extraído de un proceso largo de
diseño, listo para que lo uses como base de una app real.

## Por qué existe esto

Todas las fórmulas de este código fueron diseñadas, discutidas y validadas a mano en una
sesión de diseño de juego. No son un borrador — cada número (topes de 20, magnitudes de
ítems, probabilidades de Parry, etc.) fue elegido a propósito y con una razón documentada
en `docs/diseño_juego_codigo_barras.md` (o el PDF con el mismo nombre). **Leé ese documento
primero** si vas a tocar el balance de algo — ahí está el porqué de cada decisión.

## Estructura

```
src/
  data/
    continents.js   — rangos GS1 reales -> continente, traits, colores
    abilities.js     — las 10 habilidades especiales + las 5 clases (con Parry por clase)
  core/
    character.js     — generateCharacter(code13): motor completo de generación
    squad.js          — relation(), wheelModifier(), analyzeSquad(): rueda elemental + escuadrones
    combat.js         — baseDamage(), hpMax(), resolveParry(), resolveTurnOrder()
    items.js          — generateItem(code13): las 6 categorías de ítems desde ISBN
test.mjs             — prueba rápida en Node, corré `node test.mjs` para ver todo en accion
```

Todo está en JavaScript puro (ES modules), sin dependencias — para que lo puedas importar
directo en React, React Native, Vue, o lo que decidas usar para la app real.

## Punto de partida rápido

```js
import { generateCharacter } from "./src/core/character.js";
import { analyzeSquad } from "./src/core/squad.js";
import { generateItem } from "./src/core/items.js";

const personaje = generateCharacter("3685957489060"); // 13 digitos EAN-13 validos
const escuadron = analyzeSquad(["Europa", "America", "Asia"]); // 3 continentes, principal primero
const item = generateItem("9784038854217"); // 13 digitos ISBN (978/979) validos
```

## Lo que este starter NO incluye todavía (a propósito)

- **Escaneo de cámara real**: para eso, en una app React Native/Expo, la librería más usada
  es `expo-camera` + `expo-barcode-scanner` (o `vision-camera-code-scanner` si vas con
  React Native puro). Para web, `zxing-js` o `quagga2` leen la cámara del navegador.
- **State machine de combate completa** (turnos, quién está activo, cuándo entra el
  siguiente personaje): `combat.js` da las funciones puras de cálculo, pero orquestar
  el flujo de un duelo completo es más fácil de escribir directo en la capa de UI del
  framework que elijas. Hay un ejemplo funcional completo (en HTML/JS vanilla) en el
  historial de la conversación de diseño si querés un punto de partida para portar.
- **Generación de imágenes**: el sistema de prompt jerarquizado y la integración con
  Pollinations.ai (gratis, sin cuenta, con seed determinístico) está documentado en la
  sección 12 del documento de diseño — no está en código todavía.
- **Persistencia** (colección del jugador, progreso): no hay ninguna base de datos ni
  storage acá, es puro cálculo sin estado.

## Sugerencia de stack para la primera versión jugable

Dado que el motor ya es JS puro sin dependencias, algo tipo **Vite + React** (web) o
**Expo + React Native** (si el objetivo final es celular con cámara real) son los caminos
más directos. Si arrancás en web primero, podés simular el escaneo con un input manual
(como hicimos en los prototipos de chat) y sumar la cámara real después sin tocar el
motor de reglas — todo lo que está en `src/core` es agnóstico de plataforma.

## Pendientes conocidos (ver también la sección 13 del documento de diseño)

- Balance: correr simulaciones automáticas en volumen para detectar combos rotos.
- Playtesting con productos reales.
- El botón "Confirmar escuadrón" de los prototipos de UI tenía un bug conocido (mandaba
  texto fijo en vez del estado real) — no aplica a este starter porque acá no hay UI,
  pero quedó anotado por si portás esas pantallas.
