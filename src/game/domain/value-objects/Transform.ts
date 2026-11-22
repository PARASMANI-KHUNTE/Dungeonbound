import { Vector2 } from './Vector2';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Transform {
  readonly position: Vector2;
  readonly facing: Direction;
}

export function createTransform(position: Vector2, facing: Direction = 'down'): Transform {
  return Object.freeze({ position, facing });
}
