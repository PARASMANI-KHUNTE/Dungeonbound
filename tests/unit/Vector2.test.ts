import {
  addVectors,
  createVector2,
  distanceBetween,
  normalizeVector,
  scaleVector,
  subtractVectors,
  vectorEquals,
  vectorLength,
} from '@/game/domain/value-objects/Vector2';

describe('Vector2 Value Object', () => {
  it('creates immutable 2D vectors', () => {
    const v = createVector2(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
    expect(Object.isFrozen(v)).toBe(true);
  });

  it('calculates vector length correctly', () => {
    const v = createVector2(3, 4);
    expect(vectorLength(v)).toBe(5);
  });

  it('normalizes non-zero vectors to unit length', () => {
    const v = createVector2(10, 0);
    const normalized = normalizeVector(v);
    expect(normalized.x).toBe(1);
    expect(normalized.y).toBe(0);
    expect(vectorLength(normalized)).toBe(1);
  });

  it('returns zero vector when normalizing zero length vector', () => {
    const v = createVector2(0, 0);
    const normalized = normalizeVector(v);
    expect(normalized.x).toBe(0);
    expect(normalized.y).toBe(0);
  });

  it('performs vector addition and subtraction', () => {
    const a = createVector2(5, 10);
    const b = createVector2(2, 3);
    expect(addVectors(a, b)).toEqual({ x: 7, y: 13 });
    expect(subtractVectors(a, b)).toEqual({ x: 3, y: 7 });
  });

  it('scales vectors by a scalar', () => {
    const v = createVector2(4, -2);
    expect(scaleVector(v, 2.5)).toEqual({ x: 10, y: -5 });
  });

  it('calculates Euclidean distance between two points', () => {
    const a = createVector2(0, 0);
    const b = createVector2(6, 8);
    expect(distanceBetween(a, b)).toBe(10);
  });

  it('checks approximate equality with epsilon', () => {
    const a = createVector2(1.0000001, 2.0);
    const b = createVector2(1.0, 2.0000001);
    expect(vectorEquals(a, b)).toBe(true);
  });
});
