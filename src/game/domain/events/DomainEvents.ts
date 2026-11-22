import { Vector2 } from '../value-objects/Vector2';

export type DomainEvent =
  | { type: 'PLAYER_DAMAGED'; amount: number; sourceId?: string }
  | { type: 'ENEMY_DAMAGED'; enemyId: string; amount: number; sourceId?: string }
  | { type: 'ENEMY_DEFEATED'; enemyId: string; enemyType: string; xpReward: number }
  | { type: 'PLAYER_DIED' }
  | { type: 'PLAYER_RESPAWNED'; position: Vector2 };
