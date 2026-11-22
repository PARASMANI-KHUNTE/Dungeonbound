import { Direction, Transform, createTransform } from '../value-objects/Transform';
import { Vector2 } from '../value-objects/Vector2';

export type PlayerAnimationState = 'idle' | 'walk' | 'attack' | 'hurt' | 'dead';

export interface PlayerAnimation {
  readonly state: PlayerAnimationState;
  readonly frame: number; // 0..3 for walk cycle
  readonly timerMs: number;
}

export interface PlayerStats {
  readonly maxHealth: number;
  readonly attack: number;
  readonly defense: number;
  readonly moveSpeed: number; // world units per second, e.g. 120
}

export interface PlayerEntity {
  readonly id: string;
  readonly transform: Transform;
  readonly stats: PlayerStats;
  readonly currentHealth: number;
  readonly animation: PlayerAnimation;
}

export function createPlayerEntity(
  id: string,
  initialPosition: Vector2,
  facing: Direction = 'down',
  stats?: Partial<PlayerStats>,
  animationState: PlayerAnimationState = 'idle'
): PlayerEntity {
  const defaultStats: PlayerStats = {
    maxHealth: 100,
    attack: 10,
    defense: 5,
    moveSpeed: 120,
    ...stats,
  };

  return Object.freeze({
    id,
    transform: createTransform(initialPosition, facing),
    stats: Object.freeze(defaultStats),
    currentHealth: defaultStats.maxHealth,
    animation: Object.freeze({
      state: animationState,
      frame: 0,
      timerMs: 0,
    }),
  });
}

export function updatePlayerTransform(player: PlayerEntity, transform: Transform): PlayerEntity {
  return Object.freeze({
    ...player,
    transform,
  });
}

export function updatePlayerAnimation(player: PlayerEntity, animation: PlayerAnimation): PlayerEntity {
  return Object.freeze({
    ...player,
    animation: Object.freeze(animation),
  });
}
