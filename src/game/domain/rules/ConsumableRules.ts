import { InventoryItem, ItemDefinition } from '../items/ItemTypes';

export interface CanUseItemResult {
  readonly canUse: boolean;
  readonly reason?: string;
  readonly itemDef?: ItemDefinition;
}

export function canUseItem(
  item: InventoryItem,
  currentHealth: number,
  maxHealth: number,
  getItemDef: (id: string) => ItemDefinition | undefined
): CanUseItemResult {
  const itemDef = getItemDef(item.itemId);
  if (!itemDef) {
    return Object.freeze({ canUse: false, reason: 'Unknown item' });
  }

  if (itemDef.type !== 'consumable' || !itemDef.useEffect) {
    return Object.freeze({
      canUse: false,
      reason: `"${itemDef.name}" is not a usable consumable`,
      itemDef,
    });
  }

  const effect = itemDef.useEffect;
  if (effect.type === 'HEAL') {
    if (currentHealth >= maxHealth) {
      return Object.freeze({
        canUse: false,
        reason: 'Health is already full',
        itemDef,
      });
    }
  }

  return Object.freeze({ canUse: true, itemDef });
}

export interface UseItemResult {
  readonly success: boolean;
  readonly reason?: string;
  readonly newHealth: number;
  readonly effectMessage: string;
}

export function applyConsumableEffect(
  item: InventoryItem,
  currentHealth: number,
  maxHealth: number,
  getItemDef: (id: string) => ItemDefinition | undefined
): UseItemResult {
  const check = canUseItem(item, currentHealth, maxHealth, getItemDef);
  if (!check.canUse || !check.itemDef || !check.itemDef.useEffect) {
    return Object.freeze({
      success: false,
      reason: check.reason ?? 'Cannot use item',
      newHealth: currentHealth,
      effectMessage: '',
    });
  }

  const effect = check.itemDef.useEffect;
  if (effect.type === 'HEAL') {
    const healedHealth = Math.min(maxHealth, currentHealth + effect.amount);
    const actualHealed = healedHealth - currentHealth;
    return Object.freeze({
      success: true,
      newHealth: healedHealth,
      effectMessage: `Restored ${actualHealed} HP`,
    });
  }

  return Object.freeze({
    success: false,
    reason: 'Unsupported effect type',
    newHealth: currentHealth,
    effectMessage: '',
  });
}
