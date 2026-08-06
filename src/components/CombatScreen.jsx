import { useEffect, useState } from "react";
import { generateCharacter, randomCode } from "../core/character.js";
import { analyzeSquad, applyRarezaToBuffs, relation } from "../core/squad.js";
import { computeAttack, resolveParry, resolveTurnOrder, applyIncoming } from "../core/combat.js";
import { decideAction, applyAbility, tickTurnStart, ENERGY_MAX } from "../core/abilities.js";
import { applyItemToStats, itemLabel } from "../core/items.js";
import PixelSprite from "./PixelSprite.jsx";

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
      energy: 0,
      status: {}, // dodgeNext / halfDmgNext / paralized / regenTurnsLeft / regenAmount / fuerzaBuff
      abilityCooldown: 0,
      abilityUsedOnce: false,
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
    phase: "battle", winner: null,
  };
}

function performAction(state, side, action) {
  const attackerArr = side === "player" ? state.player : state.rival;
  const defenderArr = side === "player" ? state.rival : state.player;
  const attackerIdx = side === "player" ? state.playerActive : state.rivalActive;
  const defenderIdx = side === "player" ? state.rivalActive : state.playerActive;
  const attacker = attackerArr[attackerIdx];
  const defender = defenderArr[defenderIdx];

  const log = [...state.log];
  let newAttacker;
  let newDefender;

  if (action === "ability") {
    const result = applyAbility(attacker, defender);
    newAttacker = result.attacker;
    newDefender = result.defender;
    log.push(...result.log);
  } else if (action === "parry") {
    newAttacker = { ...attacker, parryArmed: true };
    newDefender = { ...defender };
    log.push(`${attacker.character.nombre} se prepara para bloquear.`);
  } else {
    newAttacker = { ...attacker, parryArmed: false };
    newDefender = { ...defender };
    if (defender.parryArmed) {
      const rel = relation(attacker.character.continente, defender.character.continente);
      const { dmg: rawDmg } = computeAttack(attacker, defender);
      const result = resolveParry({ ...defender.character, stats: defender.stats }, rel, rawDmg);
      newDefender.parryArmed = false;
      if (result.blocked) {
        if (result.reflectDmg > 0) {
          const applied = applyIncoming(newAttacker.status, result.reflectDmg);
          newAttacker.status = applied.status;
          newAttacker.hp = Math.max(0, attacker.hp - applied.dmg);
          log.push(`${defender.character.nombre} bloquea y refleja ${applied.dmg} de daño a ${attacker.character.nombre}.`);
        } else if (result.energyGain > 0) {
          newDefender.energy = Math.min(ENERGY_MAX, defender.energy + result.energyGain);
          log.push(`${defender.character.nombre} bloquea (afín) y gana Energía.`);
        } else {
          log.push(`${defender.character.nombre} bloquea el golpe de ${attacker.character.nombre}.`);
        }
      } else {
        const applied = applyIncoming(newDefender.status, rawDmg);
        newDefender.status = applied.status;
        newDefender.hp = Math.max(0, defender.hp - applied.dmg);
        log.push(`${attacker.character.nombre} ataca — ${defender.character.nombre} falla el bloqueo y recibe ${applied.dmg}.`);
      }
    } else {
      const { dmg: rawDmg, isCrit } = computeAttack(attacker, defender);
      const applied = applyIncoming(newDefender.status, rawDmg);
      newDefender.status = applied.status;
      newDefender.hp = Math.max(0, defender.hp - applied.dmg);
      if (applied.dodged) {
        log.push(`${attacker.character.nombre} ataca — ¡${defender.character.nombre} esquiva el golpe!`);
      } else {
        log.push(
          `${attacker.character.nombre} ataca a ${defender.character.nombre} por ${applied.dmg}` +
          `${isCrit ? " (¡Crítico!)" : ""}${applied.halved ? " (mitigado a la mitad)" : ""}.`
        );
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

  return { player: newPlayer, rival: newRival, playerActive, rivalActive, turn, log, phase, winner };
}

/** Un paso completo del autobattle: tickea el estado de quien actua (paralisis/regen/energia
 * pasiva/cooldown — ver abilities.js#tickTurnStart), y si no perdio el turno por parálisis,
 * decide y ejecuta su accion. Un solo punto de entrada para el loop en el useEffect de abajo. */
function advanceTurn(state) {
  const side = state.turn;
  const attackerArr = side === "player" ? state.player : state.rival;
  const attackerIdx = side === "player" ? state.playerActive : state.rivalActive;
  const defenderArr = side === "player" ? state.rival : state.player;
  const defenderIdx = side === "player" ? state.rivalActive : state.playerActive;

  const { battler: tickedAttacker, skip, log: tickLog } = tickTurnStart(attackerArr[attackerIdx]);

  const newAttackerArr = [...attackerArr];
  newAttackerArr[attackerIdx] = tickedAttacker;
  const newPlayer = side === "player" ? newAttackerArr : state.player;
  const newRival = side === "rival" ? newAttackerArr : state.rival;
  const stateAfterTick = { ...state, player: newPlayer, rival: newRival, log: [...state.log, ...tickLog] };

  if (skip) {
    return { ...stateAfterTick, turn: side === "player" ? "rival" : "player" };
  }

  const opponent = defenderArr[defenderIdx];
  const action = decideAction(tickedAttacker, opponent);
  return performAction(stateAfterTick, side, action);
}

const SPEED_DELAY = { 1: 1100, 2: 550 };

export default function CombatScreen({ playerTeam, playerItems, onTeam }) {
  const [battle, setBattle] = useState(() => initialBattle(playerTeam, playerItems, randomRivalTeam()));
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (battle.phase !== "battle") return;
    const timeout = setTimeout(() => {
      // Revalida contra el estado actual (no la clausura de este efecto): evita que un turno se
      // resuelva dos veces o fuera de orden si dos actualizaciones se pisan entre si.
      setBattle((prev) => (prev.phase === "battle" ? advanceTurn(prev) : prev));
    }, SPEED_DELAY[speed]);
    return () => clearTimeout(timeout);
    // battle.player/battle.rival (no solo *Active): si alguien muere y el reemplazo hereda el
    // mismo "turn", el efecto no se re-dispararia sin esto y el autobattle quedaria trabado.
  }, [battle.turn, battle.phase, battle.player, battle.rival, speed]);

  const restart = () => setBattle(initialBattle(playerTeam, playerItems, randomRivalTeam()));

  return (
    <div className="combat-screen">
      <div className="combat-row">
        {battle.player.map((b, i) => (
          <CombatSlot key={b.character.code} battler={b} active={i === battle.playerActive} />
        ))}
      </div>

      <div className="combat-vs">VS</div>

      <div className="combat-row">
        {battle.rival.map((b, i) => (
          <CombatSlot key={b.character.code} battler={b} active={i === battle.rivalActive} />
        ))}
      </div>

      <div className="combat-log pixel-scroll">
        {battle.log.slice(-8).map((line, i) => (
          <div key={i} className="combat-log-line">{line}</div>
        ))}
      </div>

      {battle.phase === "battle" ? (
        <div className="combat-actions">
          <button
            type="button"
            className="scan-again scan-again--secondary combat-speed-btn"
            onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
          >
            Velocidad ×{speed}
          </button>
        </div>
      ) : (
        <div className={`combat-banner combat-banner--${battle.winner}`}>
          {battle.winner === "player" ? "¡Victoria!" : "Derrota"}
        </div>
      )}

      <div className="result-actions">
        {battle.phase === "over" && (
          <button className="scan-again" onClick={restart}>
            Otro combate
          </button>
        )}
        <button className="scan-again scan-again--secondary" onClick={onTeam}>
          Volver al Equipo
        </button>
      </div>
    </div>
  );
}

function CombatSlot({ battler, active }) {
  const { character, item, hp, alive, parryArmed, energy, status } = battler;
  const hpPct = Math.max(0, Math.round((hp / character.hpMax) * 100));
  const energyPct = Math.max(0, Math.round((energy / ENERGY_MAX) * 100));
  return (
    <div
      className={[
        "combat-slot",
        active ? "combat-slot--active" : "",
        !alive ? "combat-slot--dead" : "",
      ].join(" ").trim()}
    >
      <div className="combat-slot-headshot">
        <PixelSprite character={character} />
      </div>
      <div className="combat-slot-name">{character.nombre}</div>
      <div className="combat-hp-bar">
        <div className="combat-hp-fill" style={{ width: `${hpPct}%` }} />
      </div>
      <div className="combat-hp-text">{Math.max(0, Math.round(hp))} / {character.hpMax}</div>
      <div className="combat-energy-bar" title="Energía">
        <div className="combat-energy-fill" style={{ width: `${energyPct}%` }} />
      </div>
      {item && <div className="combat-item-tag">{itemLabel(item)}</div>}
      {alive && parryArmed && <div className="combat-status-tag combat-status-tag--parry">Parry listo</div>}
      {alive && status.dodgeNext && <div className="combat-status-tag">Esquivará</div>}
      {alive && status.halfDmgNext && <div className="combat-status-tag">Piel dura</div>}
      {alive && status.regenTurnsLeft > 0 && <div className="combat-status-tag">Regenerando</div>}
      {alive && status.paralized && <div className="combat-status-tag combat-status-tag--bad">Paralizado</div>}
    </div>
  );
}
