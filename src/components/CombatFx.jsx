// src/components/CombatFx.jsx
// Traduce los `events` estructurados que arma CombatScreen.jsx#advanceTurn (uno por golpe/parry/
// habilidad/cura, ver su comentario) en ayuda visual transitoria: highlight sobre quien actua,
// temblor sobre quien recibe daño, y numeros flotantes (-daño en rojo/violeta, +cura en verde).
// No toca el estado del combate — es puramente decorativo, vive y se limpia solo aca.
import { useEffect, useRef, useState } from "react";
import { sfxHit, sfxBlock, sfxDodge, sfxAbility } from "../audio.js";

const HIGHLIGHT_MS = 650;
const FLOATER_MS = 900;

const TURN_LABEL = { attack: "¡Ataca!", parry: "¡Parry!", ability: "¡Habilidad!", block: "¡Bloqueo!" };
const TURN_CLASS = {
  attack: "combat-fx--attack",
  parry: "combat-fx--parry",
  ability: "combat-fx--ability",
  block: "combat-fx--block",
};

/** `children` es una render-prop: recibe `fxFor(side, idx)` y devuelve el JSX de las filas de
 * combate, para que cada CombatSlot pueda pedir su propia ayuda visual sin que este componente
 * necesite saber nada de layout. */
export default function CombatFx({ events, eventSeq, children }) {
  const [turnFx, setTurnFx] = useState({});
  const [hitSeq, setHitSeq] = useState({});
  const [floaters, setFloaters] = useState([]);
  const seenSeq = useRef(-1);

  useEffect(() => {
    if (seenSeq.current === eventSeq || !events || events.length === 0) return;
    seenSeq.current = eventSeq;

    const newTurnFx = [];
    const hitKeys = [];
    const newFloaters = [];
    let n = 0;

    for (const ev of events) {
      const key = `${ev.side}-${ev.idx}`;
      if (ev.kind === "actor") {
        newTurnFx.push({ key, cls: TURN_CLASS[ev.action], label: TURN_LABEL[ev.action] });
        if (ev.action === "ability") sfxAbility();
      } else if (ev.kind === "block") {
        newTurnFx.push({ key, cls: TURN_CLASS.block, label: TURN_LABEL.block });
        sfxBlock();
      } else if (ev.kind === "damage") {
        hitKeys.push(key);
        newFloaters.push({
          id: `${eventSeq}-${n++}`, key, text: `-${ev.amount}`,
          cls: ev.source === "ability" ? "combat-fx-num--ability" : "combat-fx-num--dmg",
        });
        sfxHit();
      } else if (ev.kind === "heal") {
        newFloaters.push({ id: `${eventSeq}-${n++}`, key, text: `+${ev.amount}`, cls: "combat-fx-num--heal" });
      } else if (ev.kind === "dodge") {
        newFloaters.push({ id: `${eventSeq}-${n++}`, key, text: "¡Esquiva!", cls: "combat-fx-num--dodge" });
        sfxDodge();
      } else if (ev.kind === "paralized") {
        newFloaters.push({ id: `${eventSeq}-${n++}`, key, text: "¡Paralizado!", cls: "combat-fx-num--bad" });
      } else if (ev.kind === "miss") {
        newFloaters.push({ id: `${eventSeq}-${n++}`, key, text: "Sin efecto", cls: "combat-fx-num--dodge" });
      }
    }

    if (newTurnFx.length) {
      setTurnFx((prev) => {
        const next = { ...prev };
        for (const t of newTurnFx) next[t.key] = { cls: t.cls, label: t.label };
        return next;
      });
      newTurnFx.forEach((t) => {
        setTimeout(() => {
          setTurnFx((prev) => {
            if (prev[t.key]?.cls !== t.cls) return prev; // ya lo piso un evento mas nuevo
            const next = { ...prev };
            delete next[t.key];
            return next;
          });
        }, HIGHLIGHT_MS);
      });
    }

    if (hitKeys.length) {
      setHitSeq((prev) => {
        const next = { ...prev };
        for (const key of hitKeys) next[key] = (next[key] || 0) + 1;
        return next;
      });
    }

    if (newFloaters.length) {
      setFloaters((prev) => [...prev, ...newFloaters]);
      newFloaters.forEach((f) => {
        setTimeout(() => {
          setFloaters((prev) => prev.filter((x) => x.id !== f.id));
        }, FLOATER_MS);
      });
    }
  }, [eventSeq, events]);

  const fxFor = (side, idx) => {
    const key = `${side}-${idx}`;
    return {
      turnCls: turnFx[key]?.cls,
      turnLabel: turnFx[key]?.label,
      hitSeq: hitSeq[key] || 0,
      floaters: floaters.filter((f) => f.key === key),
    };
  };

  return children(fxFor);
}
