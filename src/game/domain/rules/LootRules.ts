import { PickupEntity, createPickupEntity } from '../entities/PickupEntity';
import { Vector2, distanceBetween } from '../value-objects/Vector2';

export interface LootDropEntry {
  readonly itemId: string;
  readonly chance: number; // 0..1
  readonly minQuantity: number;
  readonly maxQuantity: number;
}

export const LOOT_TABLES: Record<string, readonly LootDropEntry[]> = {
  goblin_scout: [
    { itemId: 'health_potion_small', chance: 0.75, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'rusty_sword', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'bronze_ring', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
  ],
  goblin_warrior: [
    { itemId: 'health_potion_large', chance: 0.8, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'iron_broadsword', chance: 0.4, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'iron_chainmail', chance: 0.35, minQuantity: 1, maxQuantity: 1 },
  ],
};

export function rollLoot(
  enemyType: string,
  dropPosition: Vector2,
  idGenerator: () => string = () => `pickup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  randomFn: () => number = Math.random
): PickupEntity[] {
  const table = LOOT_TABLES[enemyType] ?? LOOT_TABLES.goblin_scout;
  const pickups: PickupEntity[] = [];

  for (let i = 0; i < table.length; i++) {
    const entry = table[i];
    const roll = randomFn();
    if (roll <= entry.chance) {
      const quantity = Math.floor(roll * (entry.maxQuantity - entry.minQuantity + 1)) + entry.minQuantity;
      // Scatter slightly around drop center (offset by -8..+8 px)
      const offsetX = (randomFn() - 0.5) * 16;
      const offsetY = (randomFn() - 0.5) * 16;
      const position = {
        x: dropPosition.x + offsetX,
        y: dropPosition.y + offsetY,
      };

      pickups.push(
        createPickupEntity(idGenerator(), entry.itemId, position, quantity, 26, Date.now())
      );
    }
  }

  return pickups;
}

export function canCollectPickup(
  playerPosition: Vector2,
  pickup: PickupEntity
): boolean {
  return distanceBetween(playerPosition, pickup.position) <= pickup.pickupRadius;
}
