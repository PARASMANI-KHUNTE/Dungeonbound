import { EquipmentSlot } from '../items/ItemTypes';
import { PlayerStatsBonus } from '../rules/ProgressionRules';
import { Vector2 } from '../value-objects/Vector2';

export type DomainEvent =
  | { type: 'PLAYER_DAMAGED'; amount: number; sourceId?: string }
  | { type: 'ENEMY_DAMAGED'; enemyId: string; amount: number; sourceId?: string }
  | { type: 'ENEMY_DEFEATED'; enemyId: string; enemyType: string; xpReward: number }
  | { type: 'PLAYER_DIED' }
  | { type: 'PLAYER_RESPAWNED'; position: Vector2 }
  | { type: 'LEVEL_UP'; oldLevel: number; newLevel: number; statBonus: PlayerStatsBonus }
  | { type: 'ITEM_DROPPED'; pickupId: string; itemId: string; quantity: number; position: Vector2 }
  | { type: 'ITEM_COLLECTED'; pickupId: string; itemId: string; quantity: number }
  | { type: 'ITEM_USED'; itemId: string; effectMessage: string }
  | { type: 'ITEM_EQUIPPED'; itemId: string; slot: EquipmentSlot }
  | { type: 'ITEM_UNEQUIPPED'; itemId: string; slot: EquipmentSlot };
