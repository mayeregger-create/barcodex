import { useEffect, useState } from "react";
import { generateCharacter, randomCode } from "../core/character.js";
import { analyzeSquad, applyRarezaToBuffs, relation } from "../core/squad.js";
import { computeAttack, resolveParry, resolveTurnOrder, applyIncoming } from "../core/combat.js";
import { decideAction, applyAbility, tickTurnStart, registerHitTaken, registerHitDealt, grantAbilityCharge } from "../core/abilities.js";
import { applyItemToStats, itemLabel } from "../core/items.js";
import PixelSprite from "./PixelSprite.jsx";
import CombatFx from "./CombatFx.jsx";
import BattleSummary from "./BattleSummary.jsx";
import CombatFirstRunTutorial from "./CombatFirstRunTutorial.jsx";
import { hasSeenCombatTutorial, markSeenCombatTutorial } from "../onboarding.js";

/** Rival de CPU: en el juego final seria otro jugador — para pruebas, un escuadron al azar. */
function randomRivalTeam() {
  return [randomCode(), randomCode(), randomCode()].map(generateCharacter);
}

/** Stats efectivas del personaje con su item asignado aplicado (solo Elixir/Arma/Armadura tienen
 * bonus numerico — Libro/Accesorio/Reliquia son efectos de texto, todavia no simulados). */
function effectiveStats(character, item) {
  if (!item) return character.stats;
  if (item.categoria === "Elixir" || item.categoria === "Arma" || item.categoria === "Armadura/Casco") {
    const isAffinClass = item.categoria === "Arma" && item.claseAfin === character.clase;
    return applyItemToStats(character.stats, item, isAffinClass);
  }
  return character.stats;
}

function makeSide(team, items = []) {
  const analysis = analyzeSquad(team.map((c) => c.continente));
  const buffs = applyRarezaToBuffs(analysis.buffs, team);
  return team.map((character, i) => {
    const item = items[i];
    return {
      character,
      item,
      stats: effectiveStats(character, item),
      hp: character.hpMax,
      alive: true,
      parryArmed: false,
      buff: buffs[i],
      status: {}, // dodgeNext / halfDmgNext / paralized / regenTurnsLeft / regenAmount / fuerzaBuff
      hitsTaken: 0,
      hitsDealt: 0,
      parryCharges: 0,
      abilityCharges: 0,
      // Acumulados de TODO el combate, para BattleSummary.jsx — a diferencia de hitsTaken/
      // hitsDealt (que se resetean al convertirse en carga) estos nunca bajan.
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      abilitiesUsedCount: 0,
      parriesBlockedCount: 0,
    };
  });
}

function firstAlive(side, from = 0) {
  return side.findIndex((b, i) => i >= from && b.alive);
}

function initialBattle(playerTeam, playerItems, rivalTeam) {
  const player = makeSide(playerTeam, playerItems);
  const rival = makeSide(rivalTeam);
  const turn = resolveTurnOrder(player[0].character, rival[0].character) === "A" ? "player" : "rival";
  return {
    player, rival, playerActive: 0, rivalActive: 0, turn,
    log: [`${player[0].character.nombre} vs. ${rival[0].character.nombre} — ¡comienza el combate!`],
    phase: "battle", winner: null, events: [], eventSeq: 0,
  };
}

/**
 * Ejecuta la accion de `side` este turno y devuelve el nuevo estado, incluyendo `events`: una
 * lista plana de { side, idx, kind, ... } que CombatScreen usa SOLO para disparar la ayuda
 * visual (highlight/temblor/numeros flotantes) — no afecta la simulacion en si.
 */
function performAction(state, side, action) {
  const attackerArr = side === "player" ? state.player : state.rival;
  const defenderArr = side === "player" ? state.rival : state.player;
  const attackerIdx = side === "player" ? state.playerActive : state.rivalActive;
  const defenderIdx = side === "player" ? state.rivalActive : state.playerActive;
  const defenderSide = side === "player" ? "rival" : "player";
  const attacker = attackerArr[attackerIdx];
  const defender = defenderArr[defenderIdx];

  const log = [...state.log];
  const events = [];
  let newAttacker;
  let newDefender;

  if (action === "ability") {
    const result = applyAbility(attacker, defender);
    newAttacker = result.attacker;
    newDefender = result.defender;
    log.push(...result.log);
    newAttacker.abilitiesUsedCount = (attacker.abilitiesUsedCount || 0) + 1;
    let abilityDmg = 0;
    for (const ev of result.events) {
      if (ev.role === "actor") events.push({ side, idx: attackerIdx, ...ev });
      else events.push({ side: defenderSide, idx: defenderIdx, ...ev });
      if (ev.kind === "damage") abilityDmg += ev.amount;
    }
    if (abilityDmg > 0) {
      newAttacker.totalDamageDealt = (newAttacker.totalDamageDealt || 0) + abilityDmg;
      newDefender.totalDamageTaken = (newDefender.totalDamageTaken || 0) + abilityDmg;
    }
  } else if (action === "parry") {
    newAttacker = { ...attacker, parryArmed: true, parryCharges: attacker.parryCharges - 1 };
    newDefender = { ...defender };
    log.push(`${attacker.character.nombre} gasta su carga de Parry y se prepara para bloquear.`);
    events.push({ side, idx: attackerIdx, kind: "actor", action: "parry" });
  } else {
    newAttacker = { ...attacker, parryArmed: false };
    newDefender = { ...defender };
    events.push({ side, idx: attackerIdx, kind: "actor", action: "attack" });
    if (defender.parryArmed) {
      const rel = relation(attacker.character.continente, defender.character.continente);
      const result = resolveParry(defender, attacker, rel);
      newDefender.parryArmed = false;
      if (result.blocked) {
        events.push({ side: defenderSide, idx: defenderIdx, kind: "block" });
        newDefender.parriesBlockedCount = (defender.parriesBlockedCount || 0) + 1;
        if (result.reflectDmg > 0) {
          const applied = applyIncoming(newAttacker.status, result.reflectDmg);
          newAttacker.status = applied.status;
          newAttacker.hp = Math.max(0, attacker.hp - applied.dmg);
          newAttacker = registerHitTaken(newAttacker);
          newDefender = registerHitDealt(newDefender);
          newAttacker.totalDamageTaken = (newAttacker.totalDamageTaken || 0) + applied.dmg;
          newDefender.totalDamageDealt = (newDefender.totalDamageDealt || 0) + applied.dmg;
          log.push(`${defender.character.nombre} bloquea y refleja ${applied.dmg} de daño a ${attacker.character.nombre} (ignora su Defensa).`);
          events.push({ side, idx: attackerIdx, kind: "damage", amount: applied.dmg, source: "reflect" });
        } else {
          newDefender = grantAbilityCharge(newDefender, 1);
          log.push(`${defender.character.nombre} bloquea (afín) el golpe de ${attacker.character.nombre} y suma una carga de Habilidad.`);
        }
      } else {
        const { dmg: rawDmg } = computeAttack(attacker, defender);
        const applied = applyIncoming(newDefender.status, rawDmg);
        newDefender.status = applied.status;
        newDefender.hp = Math.max(0, defender.hp - applied.dmg);
        newDefender = registerHitTaken(newDefender);
        newAttacker = registerHitDealt(newAttacker);
        newDefender.totalDamageTaken = (newDefender.totalDamageTaken || 0) + applied.dmg;
        newAttacker.totalDamageDealt = (newAttacker.totalDamageDealt || 0) + applied.dmg;
        log.push(`${attacker.character.nombre} ataca — ${defender.character.nombre} falla el bloqueo y recibe ${applied.dmg}.`);
        events.push({ side: defenderSide, idx: defenderIdx, kind: "damage", amount: applied.dmg, source: "attack" });
      }
    } else {
      const { dmg: rawDmg, isCrit } = computeAttack(attacker, defender);
      const applied = applyIncoming(newDefender.status, rawDmg);
      newDefender.status = applied.status;
      newDefender.hp = Math.max(0, defender.hp - applied.dmg);
      if (applied.dodged) {
        log.push(`${attacker.character.nombre} ataca — ¡${defender.character.nombre} esquiva el golpe!`);
        events.push({ side: defenderSide, idx: defenderIdx, kind: "dodge" });
      } else {
        newDefender = registerHitTaken(newDefender);
        newAttacker = registerHitDealt(newAttacker);
        newDefender.totalDamageTaken = (newDefender.totalDamageTaken || 0) + applied.dmg;
        newAttacker.totalDamageDealt = (newAttacker.totalDamageDealt || 0) + applied.dmg;
        log.push(
          `${attacker.character.nombre} ataca a ${defender.character.nombre} por ${applied.dmg}` +
          `${isCrit ? " (¡Crítico!)" : ""}${applied.halved ? " (mitigado a la mitad)" : ""}.`
        );
        events.push({ side: defenderSide, idx: defenderIdx, kind: "damage", amount: applied.dmg, source: "attack" });
      }
    }
  }

  const newAttackerArr = [...attackerArr];
  newAttackerArr[attackerIdx] = newAttacker;
  const newDefenderArr = [...defenderArr];
  newDefenderArr[defenderIdx] = newDefender;

  let newPlayer = side === "player" ? newAttackerArr : newDefenderArr;
  let newRival = side === "player" ? newDefenderArr : newAttackerArr;
  let playerActive = state.playerActive;
  let rivalActive = state.rivalActive;
  let turn = side === "player" ? "rival" : "player";
  let phase = state.phase;
  let winner = state.winner;

  const defenderSideKey = side === "player" ? "rival" : "player";
  const defenderSideArr = defenderSideKey === "rival" ? newRival : newPlayer;
  const defenderSideIdx = defenderSideKey === "rival" ? rivalActive : playerActive;

  if (defenderSideArr[defenderSideIdx].hp <= 0 && defenderSideArr[defenderSideIdx].alive) {
    const fallen = { ...defenderSideArr[defenderSideIdx], alive: false };
    defenderSideArr[defenderSideIdx] = fallen;
    log.push(`${fallen.character.nombre} cae.`);

    const nextIdx = firstAlive(defenderSideArr, defenderSideIdx + 1);
    if (nextIdx === -1) {
      phase = "over";
      winner = side;
      log.push(side === "player" ? "¡Ganaste el combate!" : "El rival ganó el combate.");
    } else {
      log.push(`Entra ${defenderSideArr[nextIdx].character.nombre}.`);
      if (defenderSideKey === "rival") rivalActive = nextIdx; else playerActive = nextIdx;
      const playerChar = (defenderSideKey === "player" ? defenderSideArr[nextIdx] : newPlayer[playerActive]).character;
      const rivalChar = (defenderSideKey === "rival" ? defenderSideArr[nextIdx] : newRival[rivalActive]).character;
      turn = resolveTurnOrder(playerChar, rivalChar) === "A" ? "player" : "rival";
    }
  }

  return { player: newPlayer, rival: newRival, playerActive, rivalActive, turn, log, phase, winner, events };
}

/** Un paso completo del autobattle: tickea el estado de quien actua (paralisis/regen — ver
 * abilities.js#tickTurnStart), y si no perdio el turno por parálisis, decide y ejecuta su accion
 * segun sus cargas de Parry/Habilidad (ver abilities.js#decideAction). Un solo punto de entrada
 * para el loop en el useEffect de abajo. */
function advanceTurn(state) {
  const side = state.turn;
  const attackerArr = side === "player" ? state.player : state.rival;
  const attackerIdx = side === "player" ? state.playerActive : state.rivalActive;

  const { battler: tickedAttacker, skip, log: tickLog, events: tickEvents } = tickTurnStart(attackerArr[attackerIdx]);
  const taggedTickEvents = tickEvents.map((ev) => ({ side, idx: attackerIdx, ...ev }));

  const newAttackerArr = [...attackerArr];
  newAttackerArr[attackerIdx] = tickedAttacker;
  const newPlayer = side === "player" ? newAttackerArr : state.player;
  const newRival = side === "rival" ? newAttackerArr : state.rival;
  const stateAfterTick = { ...state, player: newPlayer, rival: newRival, log: [...state.log, ...tickLog] };

  if (skip) {
    return {
      ...stateAfterTick,
      turn: side === "player" ? "rival" : "player",
      events: taggedTickEvents,
      eventSeq: state.eventSeq + 1,
    };
  }

  const action = decideAction(tickedAttacker);
  const result = performAction(stateAfterTick, side, action);
  return { ...result, events: [...taggedTickEvents, ...result.events], eventSeq: state.eventSeq + 1 };
}

const SPEED_DELAY = { 1: 1100, 2: 550 };

export default function CombatScreen({ playerTeam, playerItems, onTeam }) {
  const [battle, setBattle] = useState(() => initialBattle(playerTeam, playerItems, randomRivalTeam()));
  const [speed, setSpeed] = useState(1);
  // Primer combate de la partida: pausa el autobattle mientras se explica que es cada cosa en
  // pantalla — ver CombatFirstRunTutorial.jsx. Despues de la primera vez nunca mas aparece.
  const [showTutorial, setShowTutorial] = useState(() => !hasSeenCombatTutorial());

  useEffect(() => {
    if (battle.phase !== "battle" || showTutorial) return;
    const timeout = setTimeout(() => {
      // Revalida contra el estado actual (no la clausura de este efecto): evita que un turno se
      // resuelva dos veces o fuera de orden si dos actualizaciones se pisan entre si.
      setBattle((prev) => (prev.phase === "battle" ? advanceTurn(prev) : prev));
    }, SPEED_DELAY[speed]);
    return () => clearTimeout(timeout);
    // battle.player/battle.rival (no solo *Active): si alguien muere y el reemplazo hereda el
    // mismo "turn", el efecto no se re-dispararia sin esto y el autobattle quedaria trabado.
  }, [battle.turn, battle.phase, battle.player, battle.rival, speed, showTutorial]);

  const restart = () => setBattle(initialBattle(playerTeam, playerItems, randomRivalTeam()));

  const finishTutorial = () => {
    markSeenCombatTutorial();
    setShowTutorial(false);
  };

  if (battle.phase === "over") {
    return <BattleSummary battle={battle} onRestart={restart} onTeam={onTeam} />;
  }

  return (
    <div className="combat-screen">
      {showTutorial && <CombatFirstRunTutorial onDone={finishTutorial} />}

      <CombatFx events={battle.events} eventSeq={battle.eventSeq}>
        {(fxFor) => (
          <>
            <div className="combat-row">
              {battle.player.map((b, i) => (
                <CombatSlot key={b.character.code} battler={b} active={i === battle.playerActive} fx={fxFor("player", i)} />
              ))}
            </div>

            <div className="combat-vs">VS</div>

            <div className="combat-row">
              {battle.rival.map((b, i) => (
                <CombatSlot key={b.character.code} battler={b} active={i === battle.rivalActive} fx={fxFor("rival", i)} />
              ))}
            </div>
          </>
        )}
      </CombatFx>

      <div className="combat-log pixel-scroll">
        {battle.log.slice(-8).map((line, i) => (
          <div key={i} className="combat-log-line">{line}</div>
        ))}
      </div>

      <div className="combat-actions">
        <button
          type="button"
          className="scan-again scan-again--secondary combat-speed-btn"
          onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
        >
          Velocidad ×{speed}
        </button>
      </div>
    </div>
  );
}

function CombatSlot({ battler, active, fx }) {
  const { character, item, hp, alive, parryArmed, parryCharges, abilityCharges, status } = battler;
  const hpPct = Math.max(0, Math.round((hp / character.hpMax) * 100));
  const abilityCost = character.habilidad.name === "Golpe definitivo" ? 3 : 1;
  const abilityReady = abilityCharges >= abilityCost;
  return (
    <div
      className={[
        "combat-slot",
        active ? "combat-slot--active" : "",
        !alive ? "combat-slot--dead" : "",
        fx?.turnCls || "",
      ].join(" ").trim()}
    >
      <div
        className={`combat-slot-inner${(fx?.hitSeq ?? 0) > 0 ? " combat-slot-inner--shake" : ""}`}
        key={fx?.hitSeq ?? 0}
      >
        <div className="combat-slot-headshot">
          <PixelSprite character={character} />
        </div>
        <div className="combat-slot-name">{character.nombre}</div>
        <div className="combat-hp-bar">
          <div className="combat-hp-fill" style={{ width: `${hpPct}%` }} />
        </div>
        <div className="combat-hp-text">{Math.max(0, Math.round(hp))} / {character.hpMax}</div>
        {item && <div className="combat-item-tag">{itemLabel(item)}</div>}
        {alive && parryArmed && <div className="combat-status-tag combat-status-tag--parry">Parry listo</div>}
        {alive && !parryArmed && parryCharges > 0 && <div className="combat-status-tag combat-status-tag--parry">¡Parry cargado!</div>}
        {alive && abilityReady && <div className="combat-status-tag combat-status-tag--ability">¡Habilidad lista!</div>}
        {alive && status.dodgeNext && <div className="combat-status-tag">Esquivará</div>}
        {alive && status.halfDmgNext && <div className="combat-status-tag">Piel dura</div>}
        {alive && status.regenTurnsLeft > 0 && <div className="combat-status-tag">Regenerando</div>}
        {alive && status.paralized && <div className="combat-status-tag combat-status-tag--bad">Paralizado</div>}
      </div>

      {fx?.turnLabel && <div className="combat-fx-label">{fx.turnLabel}</div>}

      <div className="combat-fx-floaters">
        {(fx?.floaters || []).map((f) => (
          <div key={f.id} className={`combat-fx-num ${f.cls}`}>{f.text}</div>
        ))}
      </div>
    </div>
  );
}
