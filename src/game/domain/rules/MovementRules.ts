import { Direction, Transform, createTransform } from '../value-objects/Transform';
import { Vector2, createVector2, normalizeVector, vectorLength } from '../value-objects/Vector2';

export interface MovementBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface MovementStepInput {
  readonly currentTransform: Transform;
  readonly inputVector: Vector2;
  readonly speedUnitsPerSecond: number;
  readonly deltaSeconds: number;
  readonly bounds?: MovementBounds;
}

/**
 * Pure domain movement rules.
 * Invariants:
 * 1. Diagonal movement is normalized to prevent diagonal speed exploit (sqrt(2) velocity).
 * 2. Facing direction updates to the dominant axis when moving.
 * 3. Facing direction remains unchanged when input is neutral/zero.
 * 4. Movement is clamped within world bounds if bounds are specified.
 */
export function calculateFacingDirection(input: Vector2, currentFacing: Direction): Direction {
  if (input.x === 0 && input.y === 0) {
    return currentFacing;
  }
  if (Math.abs(input.x) > Math.abs(input.y)) {
    return input.x > 0 ? 'right' : 'left';
  }
  return input.y > 0 ? 'down' : 'up';
}

export function applyMovementStep(input: MovementStepInput): Transform {
  const { currentTransform, inputVector, speedUnitsPerSecond, deltaSeconds, bounds } = input;

  if (deltaSeconds <= 0 || speedUnitsPerSecond <= 0) {
    return currentTransform;
  }

  const rawLength = vectorLength(inputVector);
  if (rawLength === 0) {
    return currentTransform;
  }

  // Normalize diagonal or extended vectors to length 1.0 max
  const normalizedDirection = rawLength > 1 ? normalizeVector(inputVector) : inputVector;

  const displacementX = normalizedDirection.x * speedUnitsPerSecond * deltaSeconds;
  const displacementY = normalizedDirection.y * speedUnitsPerSecond * deltaSeconds;

  let newX = currentTransform.position.x + displacementX;
  let newY = currentTransform.position.y + displacementY;

  if (bounds) {
    newX = Math.max(bounds.minX, Math.min(bounds.maxX, newX));
    newY = Math.max(bounds.minY, Math.min(bounds.maxY, newY));
  }

  const newFacing = calculateFacingDirection(inputVector, currentTransform.facing);

  return createTransform(createVector2(newX, newY), newFacing);
}
