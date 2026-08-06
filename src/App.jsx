import { useEffect, useState } from "react";
import { generateCharacter, checkDigit, randomCode } from "./core/character.js";
import { generateItem, randomItemCode } from "./core/items.js";
import { HUES, CONTINENT_HUE } from "./data/continents.js";
import {
  addScannedCharacterCode,
  addScannedItemCode,
  getScannedCharacterCodes,
  getScannedItemCodes,
  setScannedCharacterCodes,
  setScannedItemCodes,
} from "./storage.js";
import TitleScreen from "./components/TitleScreen.jsx";
import ScanScreen from "./components/ScanScreen.jsx";
import CharacterCard from "./components/CharacterCard.jsx";
import ItemCard from "./components/ItemCard.jsx";
import CodexScreen from "./components/CodexScreen.jsx";
import TeamScreen from "./components/TeamScreen.jsx";
import CombatScreen from "./components/CombatScreen.jsx";
import BottomNav from "./components/BottomNav.jsx";

/** Arma los 13 digitos a partir de los 12 escaneados y decide si es item (ISBN) o personaje (EAN). */
function resolveScan(digits12) {
  const d13 = checkDigit(digits12);
  const code13 = digits12 + d13;
  const isBook = code13.startsWith("978") || code13.startsWith("979");
  if (isBook) {
    return { kind: "item", data: generateItem(code13) };
  }
  return { kind: "character", data: generateCharacter(code13) };
}

// Pantallas donde la barra inferior queda oculta: son tomas de pantalla completa
// (titulo, revelación de escaneo, combate en curso), no "bases" entre las que navegar.
const NAV_HIDDEN_ON = ["title", "result", "combat"];

// Cantidad fija de datos de prueba mientras no hay cámara real: ni la carga automática ni el
// botón de dev-tools generan mas que esto, para no saturar la cola de imagenes de Pollinations.
const TEST_DATA_COUNT = 6;

function generateUniqueCodes(count, generateFn) {
  const codes = new Set();
  while (codes.size < count) codes.add(generateFn());
  return [...codes];
}

export default function App() {
  const [screen, setScreen] = useState("title"); // "title" | "scan" | "result" | "codex" | "team" | "combat"
  const [result, setResult] = useState(null);
  const [combatTeam, setCombatTeam] = useState(null);
  const [combatItems, setCombatItems] = useState(null);

  const handleScan = (digits12) => {
    const scanned = resolveScan(digits12);
    if (scanned.kind === "character") {
      addScannedCharacterCode(scanned.data.code);
    } else {
      addScannedItemCode(scanned.data.code);
    }
    setResult(scanned);
    setScreen("result");
  };

  const goScan = () => {
    setResult(null);
    setScreen("scan");
  };

  /** Solo para pruebas: reemplaza la colección por exactamente TEST_DATA_COUNT + TEST_DATA_COUNT
   * al azar (nunca acumula de más — reduce la presión sobre la cola de imágenes). */
  const resetTestData = () => {
    setScannedCharacterCodes(generateUniqueCodes(TEST_DATA_COUNT, randomCode));
    setScannedItemCodes(generateUniqueCodes(TEST_DATA_COUNT, randomItemCode));
  };

  // Primera carga sin datos (celular nuevo, storage vacío): precarga el set de prueba solo.
  useEffect(() => {
    if (getScannedCharacterCodes().length === 0 && getScannedItemCodes().length === 0) {
      resetTestData();
    }
  }, []);

  const goCodex = () => setScreen("codex");
  const goTeam = () => setScreen("team");
  const goCombat = (team, items) => {
    setCombatTeam(team);
    setCombatItems(items);
    setScreen("combat");
  };

  const handleNavigate = (tab) => {
    if (tab === "scan") goScan();
    else if (tab === "codex") goCodex();
    else if (tab === "team") goTeam();
    else if (tab === "combat") setScreen(combatTeam ? "combat" : "team");
  };

  const hue = screen === "result" && result?.kind === "character"
    ? HUES[CONTINENT_HUE[result.data.continente]]
    : HUES.amber;

  const showNav = !NAV_HIDDEN_ON.includes(screen);
  const showHeader = screen !== "title";
  const activeTab = screen === "result" ? "scan" : screen;

  return (
    <div className="app" style={{ "--hue-bg": hue.bg, "--hue-mid": hue.mid, "--hue-dark": hue.dark }}>
      {showHeader && (
        <header className="app-header">
          <h1>BarCodex</h1>
        </header>
      )}

      <div className={`app-content${screen === "title" ? " app-content--bleed" : ""}`}>
        {screen === "title" && <TitleScreen onStart={goScan} />}

        {screen === "scan" && (
          <ScanScreen onScan={handleScan} onCodex={goCodex} onTeam={goTeam} onRandomGenerate={resetTestData} />
        )}

        {screen === "result" && result?.kind === "character" && (
          <CharacterCard character={result.data} onScanAnother={goScan} onCodex={goCodex} />
        )}

        {screen === "result" && result?.kind === "item" && (
          <ItemCard item={result.data} onScanAnother={goScan} onCodex={goCodex} />
        )}

        {screen === "codex" && <CodexScreen onScanAnother={goScan} onTeam={goTeam} />}

        {screen === "team" && <TeamScreen onScanAnother={goScan} onCodex={goCodex} onCombat={goCombat} />}

        {screen === "combat" && combatTeam && (
          <CombatScreen playerTeam={combatTeam} playerItems={combatItems} onTeam={goTeam} />
        )}
      </div>

      {showNav && <BottomNav active={activeTab} onNavigate={handleNavigate} />}
    </div>
  );
}
