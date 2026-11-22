import { EnemyState, EnemyType } from '../domain/entities/EnemyEntity';
import { DomainEvent } from '../domain/events/DomainEvents';
import { Direction } from '../domain/value-objects/Transform';
import { Vector2 } from '../domain/value-objects/Vector2';
import { MapDefinition } from '../world/MapDefinition';

export interface EnemyRenderItem {
  readonly id: string;
  readonly enemyType: EnemyType;
  readonly position: Vector2;
  readonly facing: Direction;
  readonly currentHealth: number;
  readonly maxHealth: number;
  readonly state: EnemyState;
}

export interface RenderProjection {
  readonly player: {
    readonly position: Vector2;
    readonly facing: Direction;
    readonly currentHealth: number;
    readonly maxHealth: number;
    readonly isAttacking: boolean;
    readonly isInvulnerable: boolean;
    readonly isDead: boolean;
  };
  readonly enemies: readonly EnemyRenderItem[];
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
  readonly recentEvents: readonly DomainEvent[];
}
