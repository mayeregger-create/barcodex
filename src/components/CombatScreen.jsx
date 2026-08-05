import { useEffect, useState } from "react";
import { generateCharacter, randomCode } from "../core/character.js";
import { analyzeSquad, applyRarezaToBuffs, relation, wheelModifier } from "../core/squad.js";
import { baseDamage, critChance, resolveParry, resolveTurnOrder } from "../core/combat.js";
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
    };
  });
}

function firstAlive(side, from = 0) {
  return side.findIndex((b, i) => i >= from && b.alive);
}

function effectiveDefensa(battler) {
  return battler.stats.Defensa * (1 + (battler.buff.defensa || 0) / 100);
}

function effectiveCritChance(battler) {
  const base = critChance(battler.stats.Suerte, battler.character.clase);
  return Math.min(1, base + (battler.buff.critico || 0) / 100);
}

function computeAttack(attacker, defender) {
  const dmgMod = wheelModifier(attacker.character.continente, defender.character.continente).dmgMod;
  const isCrit = Math.random() < effectiveCritChance(attacker);
  let dmg = baseDamage(attacker.stats.Fuerza, effectiveDefensa(defender)) * dmgMod;
  if (isCrit) dmg *= 1.5;
  const resist = defender.buff.resistencia || 0;
  dmg = Math.max(1, Math.round(dmg * (1 - resist / 100)));
  return { dmg, isCrit };
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
  const newAttacker = { ...attacker };
  const newDefender = { ...defender };

  if (action === "parry") {
    newAttacker.parryArmed = true;
    log.push(`${attacker.character.nombre} se prepara para bloquear.`);
  } else {
    newAttacker.parryArmed = false;
    if (defender.parryArmed) {
      const rel = relation(attacker.character.continente, defender.character.continente);
      const { dmg } = computeAttack(attacker, defender);
      const result = resolveParry({ ...defender.character, stats: defender.stats }, rel, dmg);
      newDefender.parryArmed = false;
      if (result.blocked) {
        if (result.reflectDmg > 0) {
          newAttacker.hp = Math.max(0, attacker.hp - result.reflectDmg);
          log.push(`${defender.character.nombre} bloquea y refleja ${result.reflectDmg} de daño a ${attacker.character.nombre}.`);
        } else if (result.energyGain > 0) {
          log.push(`${defender.character.nombre} bloquea (afín) y gana Energía.`);
        } else {
          log.push(`${defender.character.nombre} bloquea el golpe de ${attacker.character.nombre}.`);
        }
      } else {
        newDefender.hp = Math.max(0, defender.hp - dmg);
        log.push(`${attacker.character.nombre} ataca — ${defender.character.nombre} falla el bloqueo y recibe ${dmg}.`);
      }
    } else {
      const { dmg, isCrit } = computeAttack(attacker, defender);
      newDefender.hp = Math.max(0, defender.hp - dmg);
      log.push(`${attacker.character.nombre} ataca a ${defender.character.nombre} por ${dmg}${isCrit ? " (¡Crítico!)" : ""}.`);
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

export default function CombatScreen({ playerTeam, playerItems, onTeam }) {
  const [battle, setBattle] = useState(() => initialBattle(playerTeam, playerItems, randomRivalTeam()));

  useEffect(() => {
    if (battle.turn !== "rival" || battle.phase !== "battle") return;
    const rivalActor = battle.rival[battle.rivalActive];
    const action = !rivalActor.parryArmed && Math.random() < 0.22 ? "parry" : "atacar";
    const timeout = setTimeout(() => {
      // Revalida contra el estado actual (no la clausura de este efecto): evita que un turno
      // se resuelva dos veces o fuera de orden si dos actualizaciones se pisan entre si.
      setBattle((prev) => (prev.turn === "rival" && prev.phase === "battle" ? performAction(prev, "rival", action) : prev));
    }, 900);
    return () => clearTimeout(timeout);
    // battle.player/battle.rival (no solo rivalActive): si el rival mata a un personaje y le
    // vuelve a tocar contra el reemplazo, "turn" sigue siendo 'rival' sin cambiar de valor — sin
    // esto el efecto no se re-dispara y el juego queda esperando un turno que nunca llega.
  }, [battle.turn, battle.phase, battle.player, battle.rival]);

  const act = (action) => {
    setBattle((prev) => (prev.turn === "player" && prev.phase === "battle" ? performAction(prev, "player", action) : prev));
  };

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
        {battle.log.slice(-6).map((line, i) => (
          <div key={i} className="combat-log-line">{line}</div>
        ))}
      </div>

      {battle.phase === "battle" ? (
        <div className="combat-actions">
          <button
            className="scan-again"
            onClick={() => act("atacar")}
            disabled={battle.turn !== "player"}
          >
            Atacar
          </button>
          <button
            className="scan-again scan-again--secondary"
            onClick={() => act("parry")}
            disabled={battle.turn !== "player"}
          >
            Parry
          </button>
          <button className="scan-again scan-again--secondary" disabled title="Próximamente">
            Habilidad especial
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
  const { character, item, hp, alive, parryArmed } = battler;
  const pct = Math.max(0, Math.round((hp / character.hpMax) * 100));
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
        <div className="combat-hp-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="combat-hp-text">{Math.max(0, Math.round(hp))} / {character.hpMax}</div>
      {item && <div className="combat-item-tag">{itemLabel(item)}</div>}
      {parryArmed && alive && <div className="combat-parry-tag">Parry listo</div>}
    </div>
  );
}
