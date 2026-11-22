export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export function createVector2(x: number, y: number): Vector2 {
  return Object.freeze({ x, y });
}

export const ZERO_VECTOR: Vector2 = Object.freeze({ x: 0, y: 0 });

export function addVectors(a: Vector2, b: Vector2): Vector2 {
  return createVector2(a.x + b.x, a.y + b.y);
}

export function subtractVectors(a: Vector2, b: Vector2): Vector2 {
  return createVector2(a.x - b.x, a.y - b.y);
}

export function scaleVector(v: Vector2, scalar: number): Vector2 {
  return createVector2(v.x * scalar, v.y * scalar);
}

export function vectorLength(v: Vector2): number {
  return Math.hypot(v.x, v.y);
}

export function normalizeVector(v: Vector2): Vector2 {
  const len = vectorLength(v);
  if (len === 0) {
    return ZERO_VECTOR;
  }
  return createVector2(v.x / len, v.y / len);
}

export function distanceBetween(a: Vector2, b: Vector2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function vectorEquals(a: Vector2, b: Vector2, epsilon = 1e-6): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}
