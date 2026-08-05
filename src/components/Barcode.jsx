// src/components/Barcode.jsx
// Codigo de barras EAN-13 real (no decorativo) a partir de character.code/item.code — el mismo
// codigo de 13 digitos que el motor de reglas ya usa (12 escaneados + digito verificador, ver
// core/character.js#checkDigit). Asi el "rectangulo con las barras que crearon al personaje" es
// literalmente ESE codigo, no un patron aleatorio.

// Tabla de codificacion EAN-13 estandar (7 modulos por digito).
const L_CODE = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G_CODE = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R_CODE = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
// El primer digito no se dibuja como barras: decide el patron L/G de los siguientes 6.
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

// Indices (sobre los 95 modulos totales) de las 3 guardas — se dibujan un poco mas altas, como en
// un codigo de barras real, para separar visualmente los dos bloques de 6 digitos.
const GUARD_RANGES = [[0, 3], [45, 50], [92, 95]];

function ean13Bits(code13) {
  const digits = code13.split("").map(Number);
  const parity = PARITY[digits[0]];
  let bits = "101";
  for (let i = 0; i < 6; i++) {
    const d = digits[1 + i];
    bits += parity[i] === "L" ? L_CODE[d] : G_CODE[d];
  }
  bits += "01010";
  for (let i = 0; i < 6; i++) {
    bits += R_CODE[digits[7 + i]];
  }
  bits += "101";
  return bits; // 95 caracteres, "1" = barra
}

function isGuard(i) {
  return GUARD_RANGES.some(([lo, hi]) => i >= lo && i < hi);
}

/** SVG del codigo de barras. Si `code` no son 13 digitos validos, no dibuja nada (mejor vacio que
 * un codigo de barras mentiroso). */
export default function Barcode({ code, className }) {
  if (!/^\d{13}$/.test(code)) return null;
  const bits = ean13Bits(code);
  const moduleW = 2;
  const height = 22;
  const guardExtra = 4;
  const width = bits.length * moduleW;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height + guardExtra}`}
      width="100%"
      height={height + guardExtra}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Código de barras ${code}`}
    >
      {[...bits].map((bit, i) =>
        bit === "1" ? (
          <rect
            key={i}
            x={i * moduleW}
            y={0}
            width={moduleW}
            height={isGuard(i) ? height + guardExtra : height}
            fill="currentColor"
          />
        ) : null
      )}
    </svg>
  );
}
