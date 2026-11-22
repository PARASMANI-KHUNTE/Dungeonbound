import { canCollectPickup, rollLoot } from '../../src/game/domain/rules/LootRules';
import { createVector2 } from '../../src/game/domain/value-objects/Vector2';

describe('LootRules', () => {
  it('rolls loot based on probabilities using deterministic mock random', () => {
    const enemyPos = createVector2(100, 100);
    // Mock random returning 0.1 so all drops trigger
    const mockRandom = () => 0.1;
    let idCounter = 1;
    const idGen = () => `pickup_${idCounter++}`;

    const pickups = rollLoot('goblin_scout', enemyPos, idGen, mockRandom);
    expect(pickups.length).toBe(3);
    expect(pickups.some((p) => p.itemId === 'health_potion_small')).toBe(true);
    expect(pickups.some((p) => p.itemId === 'rusty_sword')).toBe(true);
    expect(pickups.some((p) => p.itemId === 'bronze_ring')).toBe(true);
  });

  it('drops nothing if roll is 1.0 (exceeds all drop rates)', () => {
    const enemyPos = createVector2(100, 100);
    const mockRandom = () => 0.99;
    const pickups = rollLoot('goblin_scout', enemyPos, undefined, mockRandom);
    expect(pickups.length).toBe(0);
  });

  it('checks pickup collection distance within pickupRadius', () => {
    const pickup = {
      id: 'p1',
      itemId: 'health_potion_small',
      quantity: 1,
      position: createVector2(100, 100),
      pickupRadius: 25,
      createdAtMs: 0,
    };

    expect(canCollectPickup(createVector2(100, 100), pickup)).toBe(true); // distance 0
    expect(canCollectPickup(createVector2(115, 100), pickup)).toBe(true); // distance 15 <= 25
    expect(canCollectPickup(createVector2(130, 100), pickup)).toBe(false); // distance 30 > 25
  });
});
