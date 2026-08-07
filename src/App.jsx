import { useEffect, useState } from "react";
import { generateCharacter, checkDigit } from "./core/character.js";
import { generateItem } from "./core/items.js";
import { HUES, CONTINENT_HUE } from "./data/continents.js";
import { addScannedCharacterCode, addScannedItemCode, getScannedCharacterCodes } from "./storage.js";
import { hasVisitedCombat, markVisitedCombat, hasSeenPartyInvite, markSeenPartyInvite } from "./onboarding.js";
import { unlockAudio, playMusic, pickCombatTrack, sfxTap, sfxScanSuccess, isMuted, toggleMuted } from "./audio.js";
import TitleScreen from "./components/TitleScreen.jsx";
import ScanReveal from "./components/ScanReveal.jsx";
import ScanScreen from "./components/ScanScreen.jsx";
import CharacterCard from "./components/CharacterCard.jsx";
import ItemCard from "./components/ItemCard.jsx";
import CodexScreen from "./components/CodexScreen.jsx";
import TeamScreen from "./components/TeamScreen.jsx";
import CombatScreen from "./components/CombatScreen.jsx";
import BottomNav from "./components/BottomNav.jsx";
import PartyInviteScreen from "./components/PartyInviteScreen.jsx";

const TEAM_SIZE = 3;

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

export default function App() {
  const [screen, setScreen] = useState("title"); // "title" | "scan" | "result" | "codex" | "team" | "combat"
  const [result, setResult] = useState(null);
  const [combatTeam, setCombatTeam] = useState(null);
  const [combatItems, setCombatItems] = useState(null);
  // Código de la revelación en curso: la ficha de resultado ya está montada y lista debajo (ver
  // render mas abajo), este overlay solo dramatiza la transición hacia ella.
  const [revealCode, setRevealCode] = useState(null);
  // Overlay de una sola vez, se dispara al salir del primer combate de la partida (ver
  // onboarding.js). Vive fuera del ruteo de "screen" a proposito, igual que revealCode.
  const [showPartyInvite, setShowPartyInvite] = useState(false);
  const [muted, setMutedState] = useState(() => isMuted());

  // Musica segun pantalla — un solo lugar, cubre toda navegacion (nav, botones, "Combatir", etc).
  // Titulo tiene su propio tema; el resto de la navegación comparte uno; combate alterna al azar
  // entre las 2 pistas de pelea CADA VEZ que "screen" recien pasa a "combat" (no en cada re-render
  // — "Otro combate" no dispara este efecto de nuevo porque no toca el screen a nivel App).
  useEffect(() => {
    if (screen === "title") playMusic("title");
    else if (screen === "combat") playMusic(pickCombatTrack());
    else playMusic("ambient");
  }, [screen]);

  // Sonido de "tap" universal: un solo listener en vez de tocar cada boton de la app — ver
  // charla en el chat sobre por que los SFX se sintetizan en vez de venir de archivos.
  useEffect(() => {
    const handler = (e) => {
      if (e.target.closest("button, .codex-chip, .team-slot, .item-slot")) sfxTap();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleScan = (digits12) => {
    const scanned = resolveScan(digits12);
    if (scanned.kind === "character") {
      addScannedCharacterCode(scanned.data.code);
    } else {
      addScannedItemCode(scanned.data.code);
    }
    sfxScanSuccess();
    setResult(scanned);
    setScreen("result");
    setRevealCode(scanned.data.code);
  };

  const goScan = () => {
    setResult(null);
    setScreen("scan");
  };

  // Tap en "▶ Jugar": a diferencia de goScan (reusado por "Escanear otro" en todos lados — ese
  // tiene que ser instantáneo), acá vale una pausa corta. Es el único momento en que "Moss Gate
  // Town" (tema del título) podría llegar a sonar: los navegadores bloquean audio hasta el primer
  // gesto del usuario, y ese gesto es este mismo tap — que ya está navegando a otra pantalla. Sin
  // la pausa, el cambio a la pista "ambient" pisa el título antes de que arranque a reproducirse.
  const handleTitleStart = () => {
    unlockAudio();
    playMusic("title");
    setTimeout(goScan, 550);
  };

  const handleToggleMute = () => setMutedState(toggleMuted());

  const goCodex = () => setScreen("codex");
  const goTeam = () => setScreen("team");
  const goCombat = (team, items) => {
    setCombatTeam(team);
    setCombatItems(items);
    setScreen("combat");
  };

  // Salir de un combate ya jugado: la primera vez que esto pasa en toda la partida, se intercepta
  // con la invitación a seguir escaneando en vez de ir directo al Equipo (ver PartyInviteScreen).
  const handleExitCombat = () => {
    if (!hasSeenPartyInvite()) {
      markSeenPartyInvite();
      setShowPartyInvite(true);
    } else {
      goTeam();
    }
  };

  const handleNavigate = (tab) => {
    if (tab === "team" || tab === "combat") markVisitedCombat();
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
  // Apenas junta 3 personajes, resalta el tab Combate — hasta que lo visite una vez (ver
  // onboarding.js). No se recalcula en cada tecla: solo importa en los renders donde puede haber
  // cambiado (despues de escanear), que es barato de leer de localStorage igual.
  const highlightNavKey = getScannedCharacterCodes().length >= TEAM_SIZE && !hasVisitedCombat() ? "combat" : null;

  return (
    <div className="app" style={{ "--hue-bg": hue.bg, "--hue-mid": hue.mid, "--hue-dark": hue.dark }}>
      {showHeader && (
        <header className="app-header">
          <h1>BarCodex</h1>
          <button
            type="button"
            className="mute-toggle"
            onClick={handleToggleMute}
            aria-label={muted ? "Activar sonido" : "Silenciar"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </header>
      )}

      <div className={`app-content${["title", "scan"].includes(screen) ? " app-content--bleed" : ""}`}>
        {screen === "title" && <TitleScreen onStart={handleTitleStart} />}

        {screen === "scan" && <ScanScreen onScan={handleScan} />}

        {screen === "result" && result?.kind === "character" && (
          <CharacterCard character={result.data} onScanAnother={goScan} onCodex={goCodex} />
        )}

        {screen === "result" && result?.kind === "item" && (
          <ItemCard item={result.data} onScanAnother={goScan} onCodex={goCodex} />
        )}

        {screen === "codex" && <CodexScreen onScanAnother={goScan} onTeam={goTeam} />}

        {screen === "team" && <TeamScreen onScanAnother={goScan} onCodex={goCodex} onCombat={goCombat} />}

        {screen === "combat" && combatTeam && (
          <CombatScreen playerTeam={combatTeam} playerItems={combatItems} onTeam={handleExitCombat} />
        )}
      </div>

      {showNav && <BottomNav active={activeTab} onNavigate={handleNavigate} highlightKey={highlightNavKey} />}

      {revealCode && <ScanReveal code={revealCode} onFinish={() => setRevealCode(null)} />}

      {showPartyInvite && (
        <PartyInviteScreen
          onContinue={() => {
            setShowPartyInvite(false);
            goScan();
          }}
        />
      )}
    </div>
  );
}
