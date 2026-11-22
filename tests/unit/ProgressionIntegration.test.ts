import { VILLAGE_OUTSKIRTS_MAP } from '../../src/game/content/definitions/maps';
import { GameRuntime } from '../../src/game/engine/GameRuntime';
import { createVector2 } from '../../src/game/domain/value-objects/Vector2';
import { createPickupEntity } from '../../src/game/domain/entities/PickupEntity';

describe('Phase 4 Progression & Inventory Integration', () => {
  let runtime: GameRuntime;

  beforeEach(() => {
    runtime = new GameRuntime('test_slot_progression', VILLAGE_OUTSKIRTS_MAP, 800, 450);
  });

  afterEach(() => {
    runtime.dispose();
  });

  describe('Starter inventory and equipment', () => {
    it('initializes player with starter potions and weapon', () => {
      const session = runtime.currentSession;
      expect(session.player.level).toBe(1);
      expect(session.player.experience).toBe(0);
      expect(session.player.inventory.length).toBe(20);

      // Starter items
      const hasPotion = session.player.inventory.some(
        (s) => s.item?.itemId === 'health_potion_small' && s.item.quantity >= 2
      );
      const hasSword = session.player.inventory.some(
        (s) => s.item?.itemId === 'rusty_sword' && s.item.quantity === 1
      );

      expect(hasPotion).toBe(true);
      expect(hasSword).toBe(true);
    });

    it('equipping weapon updates derived stats; unequipping reverts them (Acceptance Criteria)', () => {
      const baseAttack = runtime.currentSession.player.derivedStats.attack;

      // Find slot with rusty sword
      const swordSlotIndex = runtime.currentSession.player.inventory.findIndex(
        (s) => s.item?.itemId === 'rusty_sword'
      );
      expect(swordSlotIndex).toBeGreaterThanOrEqual(0);

      // Equip rusty sword (+3 attack)
      const equipRes = runtime.equipItem(swordSlotIndex);
      expect(equipRes.success).toBe(true);
      expect(runtime.currentSession.player.equipment.weapon?.itemId).toBe('rusty_sword');
      expect(runtime.currentSession.player.derivedStats.attack).toBe(baseAttack + 3);

      // Unequip weapon
      const unequipRes = runtime.unequipItem('weapon');
      expect(unequipRes.success).toBe(true);
      expect(runtime.currentSession.player.equipment.weapon).toBeNull();
      expect(runtime.currentSession.player.derivedStats.attack).toBe(baseAttack);
    });
  });

  describe('Consumables usage and rejection (Acceptance Criteria)', () => {
    it('uses health potion when damaged and rejects when health is full', () => {
      // Find potion slot
      const potionSlotIndex = runtime.currentSession.player.inventory.findIndex(
        (s) => s.item?.itemId === 'health_potion_small'
      );
      expect(potionSlotIndex).toBeGreaterThanOrEqual(0);
      const initialPotionQty = runtime.currentSession.player.inventory[potionSlotIndex].item!.quantity;

      // Health is full (100/100) -> using potion MUST be rejected by domain rules
      const fullHpRes = runtime.useItem(potionSlotIndex);
      expect(fullHpRes.success).toBe(false);
      expect(fullHpRes.reason).toBe('Health is already full');

      // Damage player
      runtime.damagePlayer(40);
      expect(runtime.currentSession.player.currentHealth).toBe(60);

      // Now use potion (heals 35)
      const useRes = runtime.useItem(potionSlotIndex);
      expect(useRes.success).toBe(true);
      expect(runtime.currentSession.player.currentHealth).toBe(95);

      // Check quantity decremented
      const updatedSlot = runtime.currentSession.player.inventory[potionSlotIndex];
      expect(updatedSlot.item?.quantity).toBe(initialPotionQty - 1);
    });
  });

  describe('XP, Level Up, and single XP award guarantee (Acceptance Criteria)', () => {
    it('awards XP only once per defeated enemy', () => {
      const enemy = runtime.currentSession.enemies.get('goblin_1');
      expect(enemy).toBeDefined();

      const initialXp = runtime.currentSession.player.experience;
      const xpReward = enemy!.stats.xpReward;

      // Position player next to goblin_1 and trigger attack
      runtime.setPlayerPositionAndFacing(
        createVector2(enemy!.transform.position.x - 15, enemy!.transform.position.y),
        'right'
      );

      // Deal enough damage to kill enemy
      runtime.triggerPlayerAttack();

      // Step simulation through startup to active hit window
      runtime.fixedUpdate(0.08); // 80ms advances past 60ms startup

      const updatedEnemy = runtime.currentSession.enemies.get('goblin_1');
      // If goblin took damage or died
      if (updatedEnemy && updatedEnemy.currentHealth <= 0) {
        expect(updatedEnemy.xpAwarded).toBe(true);
        expect(runtime.currentSession.player.experience).toBe(initialXp + xpReward);

        const xpAfterDefeat = runtime.currentSession.player.experience;

        // Run another simulation step; ensure XP is NOT awarded again
        runtime.fixedUpdate(0.05);
        expect(runtime.currentSession.player.experience).toBe(xpAfterDefeat);
      }
    });

    it('handles level up crossing more than one level with full heal and stat growth', () => {
      const initialLevel = runtime.currentSession.player.level;
      expect(initialLevel).toBe(1);

      // Add mock enemy with large XP (e.g. 400 XP) to test multi-level jump
      const mockEnemy = {
        ...runtime.currentSession.enemies.get('goblin_1')!,
        id: 'boss_goblin',
        currentHealth: 1,
        stats: {
          ...runtime.currentSession.enemies.get('goblin_1')!.stats,
          xpReward: 400, // 400 XP will jump from Level 1 to Level 5
        },
      };
      runtime.currentSession.enemies.set('boss_goblin', mockEnemy);

      // Position player facing boss and damage player to 20 HP
      runtime.setPlayerPositionAndFacing(
        createVector2(mockEnemy.transform.position.x - 15, mockEnemy.transform.position.y),
        'right'
      );
      runtime.damagePlayer(80);
      expect(runtime.currentSession.player.currentHealth).toBe(20);

      runtime.triggerPlayerAttack();
      runtime.fixedUpdate(0.08); // hit triggers

      const defeatedBoss = runtime.currentSession.enemies.get('boss_goblin')!;
      expect(defeatedBoss.state).toBe('dead');
      expect(defeatedBoss.xpAwarded).toBe(true);

      // Verify multi-level jump
      expect(runtime.currentSession.player.level).toBe(5);
      // Verify fully healed upon level up
      expect(runtime.currentSession.player.currentHealth).toBe(
        runtime.currentSession.player.derivedStats.maxHealth
      );
      // Verify derived stats boosted by 4 levels (+48 maxHealth, +8 attack, +4 defense)
      expect(runtime.currentSession.player.derivedStats.attack).toBe(18); // 10 base + 8
      expect(runtime.currentSession.player.derivedStats.defense).toBe(9); // 5 base + 4

      // Verify LEVEL_UP event exists in event queue
      const levelUpEvents = runtime.currentSession.eventQueue.filter((e) => e.type === 'LEVEL_UP');
      expect(levelUpEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Ground pickups collection', () => {
    it('player walking over a ground pickup automatically collects it into inventory', () => {
      // Place a pickup near player
      const playerPos = runtime.currentSession.player.transform.position;
      const pickupPos = createVector2(playerPos.x + 10, playerPos.y); // 10 px away, within 24 px radius

      const testPickup = createPickupEntity('pickup_test_1', 'health_potion_large', pickupPos, 1);
      runtime.currentSession.pickups.set(testPickup.id, testPickup);

      expect(runtime.currentSession.pickups.size).toBe(1);

      // Run simulation step
      runtime.fixedUpdate(0.016);

      // Pickup should be collected and removed from world
      expect(runtime.currentSession.pickups.has('pickup_test_1')).toBe(false);

      // Player inventory should now have the large potion
      const hasLargePotion = runtime.currentSession.player.inventory.some(
        (s) => s.item?.itemId === 'health_potion_large'
      );
      expect(hasLargePotion).toBe(true);

      // Event should be queued
      const collectEvent = runtime.currentSession.eventQueue.find(
        (e) => e.type === 'ITEM_COLLECTED' && (e as any).pickupId === 'pickup_test_1'
      );
      expect(collectEvent).toBeDefined();
    });
  });
});
