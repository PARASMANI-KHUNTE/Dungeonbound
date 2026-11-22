import { InventoryItem, InventorySlot, ItemDefinition } from '../items/ItemTypes';

export const DEFAULT_INVENTORY_CAPACITY = 20;

export function createEmptyInventory(capacity = DEFAULT_INVENTORY_CAPACITY): readonly InventorySlot[] {
  const slots: InventorySlot[] = [];
  for (let i = 0; i < capacity; i++) {
    slots.push(Object.freeze({ slotIndex: i, item: null }));
  }
  return Object.freeze(slots);
}

export interface AddItemResult {
  readonly success: boolean;
  readonly updatedInventory: readonly InventorySlot[];
  readonly addedQuantity: number;
  readonly remainingQuantity: number;
}

export function addItemToInventory(
  inventory: readonly InventorySlot[],
  itemToAdd: { readonly itemId: string; readonly quantity: number },
  getItemDef: (id: string) => ItemDefinition | undefined,
  instanceIdGenerator: () => string = () => `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
): AddItemResult {
  const itemDef = getItemDef(itemToAdd.itemId);
  if (!itemDef || itemToAdd.quantity <= 0) {
    return Object.freeze({
      success: false,
      updatedInventory: inventory as InventorySlot[],
      addedQuantity: 0,
      remainingQuantity: itemToAdd.quantity,
    });
  }

  const maxStack = itemDef.maxStackSize;
  let remaining = itemToAdd.quantity;
  const newSlots: InventorySlot[] = inventory.map((slot) => ({ ...slot }));

  // 1. If stackable (> 1), first try to stack onto existing matching items
  if (maxStack > 1) {
    for (let i = 0; i < newSlots.length && remaining > 0; i++) {
      const slot = newSlots[i];
      if (slot.item && slot.item.itemId === itemToAdd.itemId && slot.item.quantity < maxStack) {
        const canAdd = maxStack - slot.item.quantity;
        const toAdd = Math.min(canAdd, remaining);
        newSlots[i] = Object.freeze({
          slotIndex: i,
          item: Object.freeze({
            ...slot.item,
            quantity: slot.item.quantity + toAdd,
          }),
        });
        remaining -= toAdd;
      }
    }
  }

  // 2. Fill empty slots for remaining quantity
  for (let i = 0; i < newSlots.length && remaining > 0; i++) {
    const slot = newSlots[i];
    if (slot.item === null) {
      const toAdd = Math.min(maxStack, remaining);
      newSlots[i] = Object.freeze({
        slotIndex: i,
        item: Object.freeze({
          instanceId: instanceIdGenerator(),
          itemId: itemToAdd.itemId,
          quantity: toAdd,
        }),
      });
      remaining -= toAdd;
    }
  }

  const addedQuantity = itemToAdd.quantity - remaining;
  const success = addedQuantity > 0;

  return Object.freeze({
    success,
    updatedInventory: Object.freeze(newSlots),
    addedQuantity,
    remainingQuantity: remaining,
  });
}

export interface RemoveItemResult {
  readonly success: boolean;
  readonly updatedInventory: readonly InventorySlot[];
  readonly removedItem: InventoryItem | null;
}

export function removeItemFromInventory(
  inventory: readonly InventorySlot[],
  slotIndex: number,
  quantity = 1
): RemoveItemResult {
  if (slotIndex < 0 || slotIndex >= inventory.length || quantity <= 0) {
    return Object.freeze({
      success: false,
      updatedInventory: inventory as InventorySlot[],
      removedItem: null,
    });
  }

  const slot = inventory[slotIndex];
  if (!slot.item) {
    return Object.freeze({
      success: false,
      updatedInventory: inventory as InventorySlot[],
      removedItem: null,
    });
  }

  const removeAmount = Math.min(slot.item.quantity, quantity);
  const remainingQuantity = slot.item.quantity - removeAmount;
  const newSlots = inventory.map((s) => ({ ...s }));

  if (remainingQuantity <= 0) {
    newSlots[slotIndex] = Object.freeze({ slotIndex, item: null });
  } else {
    newSlots[slotIndex] = Object.freeze({
      slotIndex,
      item: Object.freeze({
        ...slot.item,
        quantity: remainingQuantity,
      }),
    });
  }

  const removedItem: InventoryItem = Object.freeze({
    ...slot.item,
    quantity: removeAmount,
  });

  return Object.freeze({
    success: true,
    updatedInventory: Object.freeze(newSlots),
    removedItem,
  });
}
