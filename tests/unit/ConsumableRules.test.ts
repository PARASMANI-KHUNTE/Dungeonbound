import { getItemDefinition } from '../../src/game/content/definitions/items';
import { applyConsumableEffect, canUseItem } from '../../src/game/domain/rules/ConsumableRules';

describe('ConsumableRules (Acceptance Criteria)', () => {
  const potion = { instanceId: 'p1', itemId: 'health_potion_small', quantity: 2 };
  const largePotion = { instanceId: 'p2', itemId: 'health_potion_large', quantity: 1 };
  const sword = { instanceId: 's1', itemId: 'rusty_sword', quantity: 1 };

  describe('canUseItem validation', () => {
    it('allows potion when player is damaged', () => {
      const check = canUseItem(potion, 50, 100, getItemDefinition);
      expect(check.canUse).toBe(true);
    });

    it('rejects potion when health is already full', () => {
      const check = canUseItem(potion, 100, 100, getItemDefinition);
      expect(check.canUse).toBe(false);
      expect(check.reason).toBe('Health is already full');
    });

    it('rejects equipment from being consumed', () => {
      const check = canUseItem(sword, 50, 100, getItemDefinition);
      expect(check.canUse).toBe(false);
      expect(check.reason).toContain('not a usable consumable');
    });

    it('rejects unknown items', () => {
      const check = canUseItem(
        { instanceId: 'x', itemId: 'unknown', quantity: 1 },
        50,
        100,
        getItemDefinition
      );
      expect(check.canUse).toBe(false);
    });
  });

  describe('applyConsumableEffect', () => {
    it('restores health up to amount', () => {
      // Small potion heals 35
      const res = applyConsumableEffect(potion, 40, 100, getItemDefinition);
      expect(res.success).toBe(true);
      expect(res.newHealth).toBe(75);
      expect(res.effectMessage).toBe('Restored 35 HP');
    });

    it('caps healed health at maxHealth', () => {
      // Large potion heals 80, player has 80/100 -> caps at 100
      const res = applyConsumableEffect(largePotion, 80, 100, getItemDefinition);
      expect(res.success).toBe(true);
      expect(res.newHealth).toBe(100);
      expect(res.effectMessage).toBe('Restored 20 HP');
    });

    it('returns failure when item cannot be used', () => {
      const res = applyConsumableEffect(potion, 100, 100, getItemDefinition);
      expect(res.success).toBe(false);
      expect(res.newHealth).toBe(100);
      expect(res.reason).toBe('Health is already full');
    });
  });
});
