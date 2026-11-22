export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type ItemType = 'consumable' | 'weapon' | 'armor' | 'accessory' | 'material' | 'quest';

export type EquipmentSlot = 'weapon' | 'head' | 'body' | 'accessory';

export interface ItemStatModifiers {
  readonly maxHealth?: number;
  readonly attack?: number;
  readonly defense?: number;
  readonly moveSpeed?: number;
  readonly criticalChance?: number; // e.g. 0.05 for 5%
}

export type ItemUseEffect =
  | { readonly type: 'HEAL'; readonly amount: number }
  | { readonly type: 'BUFF_SPEED'; readonly amount: number; readonly durationSeconds: number };

export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: ItemType;
  readonly rarity: ItemRarity;
  readonly slot?: EquipmentSlot;
  readonly maxStackSize: number;
  readonly statModifiers?: ItemStatModifiers;
  readonly useEffect?: ItemUseEffect;
}

export interface InventoryItem {
  readonly instanceId: string;
  readonly itemId: string;
  readonly quantity: number;
}

export interface InventorySlot {
  readonly slotIndex: number;
  readonly item: InventoryItem | null;
}

export interface EquipmentState {
  readonly weapon: InventoryItem | null;
  readonly head: InventoryItem | null;
  readonly body: InventoryItem | null;
  readonly accessory: InventoryItem | null;
}
