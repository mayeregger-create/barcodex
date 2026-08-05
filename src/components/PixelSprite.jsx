import { useEffect, useRef } from "react";
import { itemSpriteSpec } from "../core/itemSprite.js";
import { drawSprite } from "../core/pixelArt/drawSprite.js";
import { drawLpcCharacter } from "../core/pixelArt/lpcCompose.js";

/** Retrato/icono pixel-art en <canvas>. Personajes: capas reales del Universal LPC Spritesheet
 * Character Generator (ver public/lpc/CREDITS.md), cargadas por red la primera vez y cacheadas
 * despues. Items: grilla pintada a mano (ver core/itemSprite.js), sin red. */
export default function PixelSprite({ character, item, className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (character) {
      let cancelled = false;
      drawLpcCharacter(canvasRef.current, character).catch((err) => {
        if (!cancelled) console.error("PixelSprite: fallo al componer personaje", err);
      });
      return () => {
        cancelled = true;
      };
    }
    const spec = itemSpriteSpec(item);
    drawSprite(canvasRef.current.getContext("2d"), spec.grid, spec.colorMap);
  }, [character, item]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ imageRendering: "pixelated", width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      aria-hidden="true"
    />
  );
}
