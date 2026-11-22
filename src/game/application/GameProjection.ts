import { EnemyState, EnemyType } from '../domain/entities/EnemyEntity';
import { PlayerAnimation } from '../domain/entities/PlayerEntity';
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
    readonly animation: PlayerAnimation;
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

/**
 * Throttled UI-only projection consumed by React HUD components.
 * Emitted at a controlled cadence (e.g. 10 Hz) or on discrete events,
 * preventing per-frame React state re-renders.
 */
export interface UiProjection {
  readonly playerHealth: number;
  readonly playerMaxHealth: number;
  readonly playerCoords: Vector2;
  readonly playerFacing: Direction;
  readonly isDead: boolean;
  readonly isPaused: boolean;
  readonly mapName: string;
  readonly aliveEnemyCount: number;
  readonly totalSteps: number;
  readonly elapsedTimeSeconds: number;
}
