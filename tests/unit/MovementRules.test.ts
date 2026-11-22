import {
  applyMovementStep,
  calculateFacingDirection,
} from '@/game/domain/rules/MovementRules';
import { createTransform } from '@/game/domain/value-objects/Transform';
import { createVector2, vectorLength } from '@/game/domain/value-objects/Vector2';

describe('MovementRules', () => {
  const initialTransform = createTransform(createVector2(100, 100), 'down');

  it('preserves position and facing when input vector is zero', () => {
    const result = applyMovementStep({
      currentTransform: initialTransform,
      inputVector: createVector2(0, 0),
      speedUnitsPerSecond: 100,
      deltaSeconds: 1 / 60,
    });

    expect(result.position.x).toBe(100);
    expect(result.position.y).toBe(100);
    expect(result.facing).toBe('down');
  });

  it('moves rightward and updates facing to right', () => {
    const result = applyMovementStep({
      currentTransform: initialTransform,
      inputVector: createVector2(1, 0),
      speedUnitsPerSecond: 60,
      deltaSeconds: 0.5,
    });

    expect(result.position.x).toBe(130);
    expect(result.position.y).toBe(100);
    expect(result.facing).toBe('right');
  });

  it('moves upward and updates facing to up', () => {
    const result = applyMovementStep({
      currentTransform: initialTransform,
      inputVector: createVector2(0, -1),
      speedUnitsPerSecond: 60,
      deltaSeconds: 0.5,
    });

    expect(result.position.x).toBe(100);
    expect(result.position.y).toBe(70);
    expect(result.facing).toBe('up');
  });

  it('normalizes diagonal velocity so speed is not sqrt(2) times faster', () => {
    const speed = 100;
    const dt = 1.0;
    // Input vector with length sqrt(2) approx 1.414
    const diagonalInput = createVector2(1, 1);

    const result = applyMovementStep({
      currentTransform: initialTransform,
      inputVector: diagonalInput,
      speedUnitsPerSecond: speed,
      deltaSeconds: dt,
    });

    const displacementX = result.position.x - initialTransform.position.x;
    const displacementY = result.position.y - initialTransform.position.y;
    const totalDistance = vectorLength(createVector2(displacementX, displacementY));

    // Total distance moved must equal speed * dt (100 units), not 141.4 units
    expect(totalDistance).toBeCloseTo(speed * dt, 4);
    expect(displacementX).toBeCloseTo(100 / Math.SQRT2, 4);
    expect(displacementY).toBeCloseTo(100 / Math.SQRT2, 4);
  });

  it('clamps movement within defined boundaries', () => {
    const bounds = { minX: 90, minY: 90, maxX: 120, maxY: 120 };

    const result = applyMovementStep({
      currentTransform: initialTransform, // (100, 100)
      inputVector: createVector2(1, 0),
      speedUnitsPerSecond: 500,
      deltaSeconds: 1.0,
      bounds,
    });

    expect(result.position.x).toBe(120);
    expect(result.position.y).toBe(100);
  });

  it('resolves dominant axis for facing direction on diagonal input', () => {
    expect(calculateFacingDirection(createVector2(0.8, 0.2), 'down')).toBe('right');
    expect(calculateFacingDirection(createVector2(-0.3, 0.9), 'up')).toBe('down');
    expect(calculateFacingDirection(createVector2(-0.8, -0.4), 'down')).toBe('left');
    expect(calculateFacingDirection(createVector2(0.1, -0.9), 'left')).toBe('up');
  });
});
