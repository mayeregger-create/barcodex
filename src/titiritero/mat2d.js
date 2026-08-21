// src/titiritero/mat2d.js
// Matrices afines 2x3 {a,b,c,d,e,f} — mismo orden de parametros que CanvasRenderingContext2D
// setTransform/transform, para que el renderer de cliente pueda pasarlas directo sin reordenar.
// Angulos en GRADOS, positivos en sentido horario (ver contrato, doc Titiritero §3.1) — en un
// canvas Y-hacia-abajo, la formula de rotacion estandar (sin negar nada) ya da ese sentido.

export function identity() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

/** Matriz local de un hueso/pieza a partir de su transform (x,y,rotation en grados,scale). */
export function fromTransform({ x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1 }) {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    a: cos * scaleX,
    b: sin * scaleX,
    c: -sin * scaleY,
    d: cos * scaleY,
    e: x,
    f: y,
  };
}

/** parent * local — compone la transformacion local dentro del espacio ya transformado del padre. */
export function multiply(parent, local) {
  return {
    a: parent.a * local.a + parent.c * local.b,
    b: parent.b * local.a + parent.d * local.b,
    c: parent.a * local.c + parent.c * local.d,
    d: parent.b * local.c + parent.d * local.d,
    e: parent.a * local.e + parent.c * local.f + parent.e,
    f: parent.b * local.e + parent.d * local.f + parent.f,
  };
}

export function transformPoint(m, x, y) {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

/** [a,b,c,d,e,f] listo para ctx.setTransform(...toArray(m)). */
export function toArray(m) {
  return [m.a, m.b, m.c, m.d, m.e, m.f];
}
