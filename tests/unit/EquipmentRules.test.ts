import { getItemDefinition } from '../../src/game/content/definitions/items';
import {
  calculateDerivedStats,
  createEmptyEquipment,
  equipItem,
  unequipItem,
} from '../../src/game/domain/rules/EquipmentRules';
import { addItemToInventory, createEmptyInventory } from '../../src/game/domain/rules/InventoryRules';

describe('EquipmentRules', () => {
  const baseStats = {
    maxHealth: 100,
    attack: 10,
    defense: 5,
    moveSpeed: 120,
    criticalChance: 0.05,
  };

  describe('Equip validation & swapping', () => {
    it('equips a weapon from inventory to equipment slot', () => {
      let inv = createEmptyInventory(4);
      const eq = createEmptyEquipment();

      inv = addItemToInventory(inv, { itemId: 'rusty_sword', quantity: 1 }, getItemDefinition)
        .updatedInventory;

      const res = equipItem(inv, eq, 0, getItemDefinition);
      expect(res.success).toBe(true);
      expect(res.updatedEquipment.weapon?.itemId).toBe('rusty_sword');
      expect(res.updatedInventory[0].item).toBeNull();
    });

    it('rejects non-equippable items (e.g. consumables)', () => {
      let inv = createEmptyInventory(4);
      const eq = createEmptyEquipment();

      inv = addItemToInventory(
        inv,
        { itemId: 'health_potion_small', quantity: 1 },
        getItemDefinition
      ).updatedInventory;

      const res = equipItem(inv, eq, 0, getItemDefinition);
      expect(res.success).toBe(false);
      expect(res.error).toContain('cannot be equipped');
      expect(res.updatedEquipment.weapon).toBeNull();
    });

    it('rejects empty inventory slot', () => {
      const inv = createEmptyInventory(4);
      const eq = createEmptyEquipment();
      const res = equipItem(inv, eq, 0, getItemDefinition);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Inventory slot is empty');
    });

    it('swaps previously equipped item into inventory', () => {
      let inv = createEmptyInventory(4);
      let eq = createEmptyEquipment();

      inv = addItemToInventory(inv, { itemId: 'rusty_sword', quantity: 1 }, getItemDefinition)
        .updatedInventory;
      inv = addItemToInventory(inv, { itemId: 'iron_broadsword', quantity: 1 }, getItemDefinition)
        .updatedInventory;

      // Equip rusty sword first (slot 0)
      let equipRes = equipItem(inv, eq, 0, getItemDefinition);
      inv = equipRes.updatedInventory;
      eq = equipRes.updatedEquipment;
      expect(eq.weapon?.itemId).toBe('rusty_sword');

      // Now equip iron broadsword from slot 1; rusty sword should be swapped back into slot 1!
      equipRes = equipItem(inv, eq, 1, getItemDefinition);
      expect(equipRes.success).toBe(true);
      expect(equipRes.updatedEquipment.weapon?.itemId).toBe('iron_broadsword');
      expect(equipRes.updatedInventory[1].item?.itemId).toBe('rusty_sword');
    });
  });

  describe('Unequipping', () => {
    it('unequips item into the first free inventory slot', () => {
      let inv = createEmptyInventory(4);
      let eq = createEmptyEquipment();

      inv = addItemToInventory(inv, { itemId: 'leather_cap', quantity: 1 }, getItemDefinition)
        .updatedInventory;
      const equipRes = equipItem(inv, eq, 0, getItemDefinition);
      inv = equipRes.updatedInventory;
      eq = equipRes.updatedEquipment;
      expect(eq.head?.itemId).toBe('leather_cap');

      const unequipRes = unequipItem(inv, eq, 'head');
      expect(unequipRes.success).toBe(true);
      expect(unequipRes.updatedEquipment.head).toBeNull();
      expect(unequipRes.updatedInventory[0].item?.itemId).toBe('leather_cap');
    });

    it('rejects unequipping from an empty equipment slot', () => {
      const inv = createEmptyInventory(4);
      const eq = createEmptyEquipment();
      const res = unequipItem(inv, eq, 'body');
      expect(res.success).toBe(false);
      expect(res.error).toContain('No item equipped');
    });

    it('rejects unequipping if inventory is full', () => {
      let inv = createEmptyInventory(1);
      let eq = createEmptyEquipment();

      inv = addItemToInventory(inv, { itemId: 'cloth_tunic', quantity: 1 }, getItemDefinition)
        .updatedInventory;
      const equipRes = equipItem(inv, eq, 0, getItemDefinition);
      inv = equipRes.updatedInventory;
      eq = equipRes.updatedEquipment;

      // Fill the only inventory slot with a potion
      inv = addItemToInventory(
        inv,
        { itemId: 'health_potion_small', quantity: 1 },
        getItemDefinition
      ).updatedInventory;

      const unequipRes = unequipItem(inv, eq, 'body');
      expect(unequipRes.success).toBe(false);
      expect(unequipRes.error).toContain('inventory is full');
      expect(unequipRes.updatedEquipment.body?.itemId).toBe('cloth_tunic');
    });
  });

  describe('Derived stats calculation (Acceptance Criteria)', () => {
    it('calculates derived stats with base stats at level 1 without equipment', () => {
      const eq = createEmptyEquipment();
      const derived = calculateDerivedStats(baseStats, 1, eq, getItemDefinition);

      expect(derived.maxHealth).toBe(100);
      expect(derived.attack).toBe(10);
      expect(derived.defense).toBe(5);
      expect(derived.moveSpeed).toBe(120);
      expect(derived.criticalChance).toBe(0.05);
    });

    it('correctly incorporates level-up stat growth and equipment modifiers', () => {
      // Level 3 gives +24 maxHealth, +4 attack, +2 defense
      // Iron broadsword (+8 attack, +0.02 crit)
      // Iron chainmail (+6 defense, +30 maxHealth)
      // Wind talisman (+20 moveSpeed)
      const eq = {
        weapon: { instanceId: 'w1', itemId: 'iron_broadsword', quantity: 1 },
        head: null,
        body: { instanceId: 'b1', itemId: 'iron_chainmail', quantity: 1 },
        accessory: { instanceId: 'a1', itemId: 'wind_talisman', quantity: 1 },
      };

      const derived = calculateDerivedStats(baseStats, 3, eq, getItemDefinition);

      // maxHealth = 100 (base) + 24 (lvl 3) + 30 (chainmail) = 154
      expect(derived.maxHealth).toBe(154);
      // attack = 10 (base) + 4 (lvl 3) + 8 (sword) = 22
      expect(derived.attack).toBe(22);
      // defense = 5 (base) + 2 (lvl 3) + 6 (chainmail) = 13
      expect(derived.defense).toBe(13);
      // moveSpeed = 120 (base) + 20 (talisman) = 140
      expect(derived.moveSpeed).toBe(140);
      // crit = 0.05 (base) + 0.02 (sword) = 0.07
      expect(derived.criticalChance).toBeCloseTo(0.07);
    });
  });
});
