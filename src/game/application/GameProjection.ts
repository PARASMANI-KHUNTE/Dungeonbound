import { Direction } from '../domain/value-objects/Transform';
import { Vector2 } from '../domain/value-objects/Vector2';
import { MapDefinition } from '../world/MapDefinition';

export interface RenderProjection {
  readonly player: {
    readonly position: Vector2;
    readonly facing: Direction;
    readonly currentHealth: number;
    readonly maxHealth: number;
  };
  readonly camera: {
    readonly position: Vector2;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
  };
  readonly map: MapDefinition;
  readonly stats: {
    readonly isPaused: boolean;
    readonly stepCount: number;
    readonly elapsedTimeSeconds: number;
  };
}
