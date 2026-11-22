import { getItemDefinition } from '../../content/definitions/items';
import { EquipmentState, InventorySlot, ItemDefinition } from '../items/ItemTypes';
import {
  PlayerDerivedStats,
  calculateDerivedStats,
  createEmptyEquipment,
} from '../rules/EquipmentRules';
import { addItemToInventory, createEmptyInventory } from '../rules/InventoryRules';
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
  readonly criticalChance?: number;
}

export interface PlayerEntity {
  readonly id: string;
  readonly transform: Transform;
  readonly stats: PlayerStats; // Base unbuffed stats
  readonly currentHealth: number;
  readonly animation: PlayerAnimation;
  readonly level: number;
  readonly experience: number;
  readonly inventory: readonly InventorySlot[];
  readonly equipment: EquipmentState;
  readonly derivedStats: PlayerDerivedStats;
}

export function createPlayerEntity(
  id: string,
  initialPosition: Vector2,
  facing: Direction = 'down',
  stats?: Partial<PlayerStats>,
  animationState: PlayerAnimationState = 'idle',
  initialLevel = 1,
  initialXp = 0
): PlayerEntity {
  const defaultStats: PlayerStats = {
    maxHealth: 100,
    attack: 10,
    defense: 5,
    moveSpeed: 120,
    criticalChance: 0.05,
    ...stats,
  };

  let starterInventory: readonly InventorySlot[] = createEmptyInventory(20);
  // Add starter items: 2 Small Health Potions and 1 Rusty Sword
  starterInventory = addItemToInventory(
    starterInventory,
    { itemId: 'health_potion_small', quantity: 2 },
    getItemDefinition
  ).updatedInventory;
  starterInventory = addItemToInventory(
    starterInventory,
    { itemId: 'rusty_sword', quantity: 1 },
    getItemDefinition
  ).updatedInventory;

  const initialEquipment = createEmptyEquipment();
  const initialDerivedStats = calculateDerivedStats(
    defaultStats,
    initialLevel,
    initialEquipment,
    getItemDefinition
  );

  return Object.freeze({
    id,
    transform: createTransform(initialPosition, facing),
    stats: Object.freeze(defaultStats),
    currentHealth: initialDerivedStats.maxHealth,
    animation: Object.freeze({
      state: animationState,
      frame: 0,
      timerMs: 0,
    }),
    level: initialLevel,
    experience: initialXp,
    inventory: Object.freeze(starterInventory),
    equipment: Object.freeze(initialEquipment),
    derivedStats: Object.freeze(initialDerivedStats),
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

export function recalculatePlayerStats(
  player: PlayerEntity,
  getItemDef: (id: string) => ItemDefinition | undefined = getItemDefinition
): PlayerEntity {
  const newDerived = calculateDerivedStats(
    player.stats,
    player.level,
    player.equipment,
    getItemDef
  );

  return Object.freeze({
    ...player,
    derivedStats: Object.freeze(newDerived),
    currentHealth: Math.min(player.currentHealth, newDerived.maxHealth),
  });
}
