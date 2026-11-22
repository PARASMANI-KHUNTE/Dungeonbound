import { EnemyEntity } from '../domain/entities/EnemyEntity';
import { PickupEntity } from '../domain/entities/PickupEntity';
import { PlayerEntity } from '../domain/entities/PlayerEntity';
import { DomainEvent } from '../domain/events/DomainEvents';
import { Vector2 } from '../domain/value-objects/Vector2';
import { Camera } from '../world/Camera';
import { CollisionGrid } from '../world/CollisionGrid';
import { MapDefinition } from '../world/MapDefinition';

export interface GameSession {
  readonly saveSlotId: string;
  readonly map: MapDefinition;
  readonly collisionGrid: CollisionGrid;
  readonly camera: Camera;
  readonly respawnPoint: Vector2;
  player: PlayerEntity;
  enemies: Map<string, EnemyEntity>;
  pickups: Map<string, PickupEntity>;
  playerAttackTimerMs: number;
  playerAttackCooldownMs: number;
  playerInvulnerableUntilMs: number;
  elapsedTimeSeconds: number;
  isPaused: boolean;
  eventQueue: DomainEvent[];
  worldFlags: Record<string, boolean | number | string>;
  questState: Record<string, unknown>;
}
