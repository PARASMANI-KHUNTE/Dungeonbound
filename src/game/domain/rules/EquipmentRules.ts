import {
  EquipmentSlot,
  EquipmentState,
  InventoryItem,
  InventorySlot,
  ItemDefinition,
  isEquipmentSlot,
} from '../items/ItemTypes';
import { calculateLevelStatBonuses } from './ProgressionRules';

export interface PlayerDerivedStats {
  readonly maxHealth: number;
  readonly attack: number;
  readonly defense: number;
  readonly moveSpeed: number;
  readonly criticalChance: number;
}

export function createEmptyEquipment(): EquipmentState {
  return Object.freeze({
    weapon: null,
    head: null,
    body: null,
    accessory: null,
  });
}

export interface EquipResult {
  readonly success: boolean;
  readonly error?: string;
  readonly updatedInventory: readonly InventorySlot[];
  readonly updatedEquipment: EquipmentState;
}

export function equipItem(
  inventory: readonly InventorySlot[],
  equipment: EquipmentState,
  inventorySlotIndex: number,
  getItemDef: (id: string) => ItemDefinition | undefined
): EquipResult {
  if (inventorySlotIndex < 0 || inventorySlotIndex >= inventory.length) {
    return Object.freeze({
      success: false,
      error: 'Invalid inventory slot index',
      updatedInventory: inventory,
      updatedEquipment: equipment,
    });
  }

  const slot = inventory[inventorySlotIndex];
  if (!slot.item) {
    return Object.freeze({
      success: false,
      error: 'Inventory slot is empty',
      updatedInventory: inventory,
      updatedEquipment: equipment,
    });
  }

  const itemDef = getItemDef(slot.item.itemId);
  if (!itemDef) {
    return Object.freeze({
      success: false,
      error: 'Item definition not found',
      updatedInventory: inventory,
      updatedEquipment: equipment,
    });
  }

  if (!itemDef.slot) {
    return Object.freeze({
      success: false,
      error: `Item "${itemDef.name}" cannot be equipped (not an equipment item)`,
      updatedInventory: inventory,
      updatedEquipment: equipment,
    });
  }

  if (!isEquipmentSlot(itemDef.slot)) {
    return Object.freeze({
      success: false,
      error: `Item "${itemDef.name}" has an invalid equipment slot`,
      updatedInventory: inventory,
      updatedEquipment: equipment,
    });
  }

  const targetSlot: EquipmentSlot = itemDef.slot;
  const currentEquipped = equipment[targetSlot];

  const newInventory: InventorySlot[] = inventory.map((s) => ({ ...s }));

  // If a piece is already equipped, swap it into the inventory slot
  if (currentEquipped) {
    newInventory[inventorySlotIndex] = Object.freeze({
      slotIndex: inventorySlotIndex,
      item: currentEquipped,
    });
  } else {
    // No previous item equipped; remove from inventory and equip
    newInventory[inventorySlotIndex] = Object.freeze({
      slotIndex: inventorySlotIndex,
      item: null,
    });
  }

  const newEquipment: EquipmentState = Object.freeze({
    ...equipment,
    [targetSlot]: slot.item,
  });

  return Object.freeze({
    success: true,
    updatedInventory: Object.freeze(newInventory),
    updatedEquipment: newEquipment,
  });
}

export interface UnequipResult {
  readonly success: boolean;
  readonly error?: string;
  readonly updatedInventory: readonly InventorySlot[];
  readonly updatedEquipment: EquipmentState;
}

export function unequipItem(
  inventory: readonly InventorySlot[],
  equipment: EquipmentState,
  slotToUnequip: EquipmentSlot
): UnequipResult {
  if (!isEquipmentSlot(slotToUnequip)) {
    return Object.freeze({
      success: false,
      error: `Invalid equipment slot: ${String(slotToUnequip)}`,
      updatedInventory: inventory,
      updatedEquipment: equipment,
    });
  }

  const itemToUnequip = equipment[slotToUnequip];
  if (!itemToUnequip) {
    return Object.freeze({
      success: false,
      error: `No item equipped in ${slotToUnequip} slot`,
      updatedInventory: inventory,
      updatedEquipment: equipment,
    });
  }

  // Find first empty slot in inventory
  const emptyIndex = inventory.findIndex((s) => s.item === null);
  if (emptyIndex === -1) {
    return Object.freeze({
      success: false,
      error: 'Cannot unequip: inventory is full',
      updatedInventory: inventory,
      updatedEquipment: equipment,
    });
  }

  const newInventory: InventorySlot[] = inventory.map((s) => ({ ...s }));
  newInventory[emptyIndex] = Object.freeze({
    slotIndex: emptyIndex,
    item: itemToUnequip,
  });

  const newEquipment: EquipmentState = Object.freeze({
    ...equipment,
    [slotToUnequip]: null,
  });

  return Object.freeze({
    success: true,
    updatedInventory: Object.freeze(newInventory),
    updatedEquipment: newEquipment,
  });
}

export function calculateDerivedStats(
  baseStats: {
    readonly maxHealth: number;
    readonly attack: number;
    readonly defense: number;
    readonly moveSpeed: number;
    readonly criticalChance?: number;
  },
  level: number,
  equipment: EquipmentState,
  getItemDef: (id: string) => ItemDefinition | undefined
): PlayerDerivedStats {
  const levelBonus = calculateLevelStatBonuses(level);

  let totalMaxHealth = baseStats.maxHealth + levelBonus.maxHealth;
  let totalAttack = baseStats.attack + levelBonus.attack;
  let totalDefense = baseStats.defense + levelBonus.defense;
  let totalMoveSpeed = baseStats.moveSpeed;
  let totalCritChance = baseStats.criticalChance ?? 0.05;

  const equippedItems: (InventoryItem | null)[] = [
    equipment.weapon,
    equipment.head,
    equipment.body,
    equipment.accessory,
  ];

  for (const item of equippedItems) {
    if (!item) continue;
    const def = getItemDef(item.itemId);
    if (!def || !def.statModifiers) continue;

    if (def.statModifiers.maxHealth) {
      totalMaxHealth += def.statModifiers.maxHealth;
    }
    if (def.statModifiers.attack) {
      totalAttack += def.statModifiers.attack;
    }
    if (def.statModifiers.defense) {
      totalDefense += def.statModifiers.defense;
    }
    if (def.statModifiers.moveSpeed) {
      totalMoveSpeed += def.statModifiers.moveSpeed;
    }
    if (def.statModifiers.criticalChance) {
      totalCritChance += def.statModifiers.criticalChance;
    }
  }

  return Object.freeze({
    maxHealth: Math.max(1, totalMaxHealth),
    attack: Math.max(1, totalAttack),
    defense: Math.max(0, totalDefense),
    moveSpeed: Math.max(10, totalMoveSpeed),
    criticalChance: Math.min(1.0, Math.max(0, totalCritChance)),
  });
}
