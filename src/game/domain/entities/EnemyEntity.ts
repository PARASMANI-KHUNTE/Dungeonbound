import { Direction, Transform, createTransform } from '../value-objects/Transform';
import { Vector2 } from '../value-objects/Vector2';

export type EnemyState = 'idle' | 'chase' | 'attack' | 'hurt' | 'dead';
export type EnemyType = 'goblin_scout' | 'goblin_warrior';

export interface EnemyStats {
  readonly maxHealth: number;
  readonly attackPower: number;
  readonly defense: number;
  readonly moveSpeed: number; // units per second
  readonly aggroRadius: number; // units
  readonly attackRange: number; // units
  readonly attackCooldownMs: number;
  readonly xpReward: number;
}

export interface EnemyEntity {
  readonly id: string;
  readonly enemyType: EnemyType;
  readonly transform: Transform;
  readonly stats: EnemyStats;
  readonly currentHealth: number;
  readonly state: EnemyState;
  readonly stateTimerMs: number;
  readonly attackCooldownRemainingMs: number;
  readonly invulnerableUntilMs: number;
}

export function createEnemyEntity(
  id: string,
  enemyType: EnemyType,
  initialPosition: Vector2,
  facing: Direction = 'down',
  statsOverrides?: Partial<EnemyStats>
): EnemyEntity {
  const defaultStats: EnemyStats = {
    maxHealth: 40,
    attackPower: 8,
    defense: 2,
    moveSpeed: 65,
    aggroRadius: 180,
    attackRange: 34,
    attackCooldownMs: 1200,
    xpReward: 25,
    ...statsOverrides,
  };

  return Object.freeze({
    id,
    enemyType,
    transform: createTransform(initialPosition, facing),
    stats: Object.freeze(defaultStats),
    currentHealth: defaultStats.maxHealth,
    state: 'idle',
    stateTimerMs: 0,
    attackCooldownRemainingMs: 0,
    invulnerableUntilMs: 0,
  });
}

export function updateEnemy(enemy: EnemyEntity, updates: Partial<EnemyEntity>): EnemyEntity {
  return Object.freeze({
    ...enemy,
    ...updates,
  });
}
