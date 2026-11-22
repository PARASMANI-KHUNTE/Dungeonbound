import { getItemDefinition } from '../../src/game/content/definitions/items';
import {
  addItemToInventory,
  createEmptyInventory,
  removeItemFromInventory,
} from '../../src/game/domain/rules/InventoryRules';

describe('InventoryRules', () => {
  it('creates empty inventory with specified capacity', () => {
    const inv = createEmptyInventory(10);
    expect(inv.length).toBe(10);
    expect(inv.every((slot) => slot.item === null)).toBe(true);
    expect(inv[0].slotIndex).toBe(0);
    expect(inv[9].slotIndex).toBe(9);
  });

  describe('Adding items & stacking', () => {
    it('adds non-stackable equipment to separate slots', () => {
      let inv = createEmptyInventory(4);
      let res = addItemToInventory(inv, { itemId: 'rusty_sword', quantity: 1 }, getItemDefinition);
      expect(res.success).toBe(true);
      expect(res.addedQuantity).toBe(1);
      expect(res.remainingQuantity).toBe(0);
      inv = res.updatedInventory;

      res = addItemToInventory(inv, { itemId: 'rusty_sword', quantity: 1 }, getItemDefinition);
      expect(res.success).toBe(true);
      inv = res.updatedInventory;

      expect(inv[0].item?.itemId).toBe('rusty_sword');
      expect(inv[0].item?.quantity).toBe(1);
      expect(inv[1].item?.itemId).toBe('rusty_sword');
      expect(inv[1].item?.quantity).toBe(1);
      expect(inv[2].item).toBeNull();
    });

    it('stacks stackable consumables up to maxStackSize', () => {
      let inv = createEmptyInventory(4);
      // Small health potion maxStackSize is 20
      let res = addItemToInventory(
        inv,
        { itemId: 'health_potion_small', quantity: 15 },
        getItemDefinition
      );
      expect(res.success).toBe(true);
      inv = res.updatedInventory;
      expect(inv[0].item?.quantity).toBe(15);

      // Add 10 more: 5 should top off slot 0 (to 20), 5 should go to slot 1
      res = addItemToInventory(
        inv,
        { itemId: 'health_potion_small', quantity: 10 },
        getItemDefinition
      );
      expect(res.success).toBe(true);
      inv = res.updatedInventory;
      expect(inv[0].item?.quantity).toBe(20);
      expect(inv[1].item?.quantity).toBe(5);
    });

    it('rejects adding items when inventory is completely full', () => {
      let inv = createEmptyInventory(2);
      inv = addItemToInventory(inv, { itemId: 'rusty_sword', quantity: 1 }, getItemDefinition)
        .updatedInventory;
      inv = addItemToInventory(inv, { itemId: 'iron_chainmail', quantity: 1 }, getItemDefinition)
        .updatedInventory;

      const res = addItemToInventory(
        inv,
        { itemId: 'health_potion_small', quantity: 1 },
        getItemDefinition
      );
      expect(res.success).toBe(false);
      expect(res.addedQuantity).toBe(0);
      expect(res.remainingQuantity).toBe(1);
    });

    it('handles unknown item definitions gracefully', () => {
      const inv = createEmptyInventory(4);
      const res = addItemToInventory(
        inv,
        { itemId: 'non_existent_item', quantity: 1 },
        getItemDefinition
      );
      expect(res.success).toBe(false);
      expect(res.remainingQuantity).toBe(1);
    });
  });

  describe('Removing items', () => {
    it('decrements stack count without clearing slot if items remain', () => {
      let inv = createEmptyInventory(4);
      inv = addItemToInventory(
        inv,
        { itemId: 'health_potion_small', quantity: 5 },
        getItemDefinition
      ).updatedInventory;

      const res = removeItemFromInventory(inv, 0, 2);
      expect(res.success).toBe(true);
      expect(res.removedItem?.quantity).toBe(2);
      expect(res.updatedInventory[0].item?.quantity).toBe(3);
    });

    it('clears slot when full quantity is removed', () => {
      let inv = createEmptyInventory(4);
      inv = addItemToInventory(
        inv,
        { itemId: 'rusty_sword', quantity: 1 },
        getItemDefinition
      ).updatedInventory;

      const res = removeItemFromInventory(inv, 0, 1);
      expect(res.success).toBe(true);
      expect(res.updatedInventory[0].item).toBeNull();
    });

    it('rejects removal from empty slot or invalid index', () => {
      const inv = createEmptyInventory(4);
      expect(removeItemFromInventory(inv, 0, 1).success).toBe(false);
      expect(removeItemFromInventory(inv, -1, 1).success).toBe(false);
      expect(removeItemFromInventory(inv, 99, 1).success).toBe(false);
    });
  });
});
