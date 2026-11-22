import { getItemDefinition } from '../content/definitions/items';
import { CURRENT_SAVE_VERSION, SaveSnapshot } from '../domain/repositories/SaveRepository';

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateSaveSnapshot(
  snapshot: unknown,
  getItemDef: typeof getItemDefinition = getItemDefinition
): ValidationResult {
  const errors: string[] = [];

  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, errors: ['Snapshot must be a non-null object'] };
  }

  const s = snapshot as Partial<SaveSnapshot>;

  // 1. Version check
  if (typeof s.version !== 'number' || s.version < 1) {
    errors.push(`Invalid save version: expected positive integer, got ${s.version}`);
  } else if (s.version > CURRENT_SAVE_VERSION) {
    errors.push(
      `Unsupported save version ${s.version}: current engine supports version <= ${CURRENT_SAVE_VERSION}`
    );
  }

  // 2. SlotId and MapId
  if (!s.slotId || typeof s.slotId !== 'string' || s.slotId.trim() === '') {
    errors.push('Missing or empty slotId');
  }
  if (!s.mapId || typeof s.mapId !== 'string' || s.mapId.trim() === '') {
    errors.push('Missing or empty mapId');
  }

  // 3. Play time
  if (typeof s.playTimeSeconds !== 'number' || isNaN(s.playTimeSeconds) || s.playTimeSeconds < 0) {
    errors.push('Invalid playTimeSeconds');
  }

  // 4. Player state
  if (!s.player || typeof s.player !== 'object') {
    errors.push('Missing player state in snapshot');
  } else {
    const p = s.player;
    if (typeof p.level !== 'number' || p.level < 1 || !Number.isInteger(p.level)) {
      errors.push(`Invalid player level: ${p.level}`);
    }
    if (typeof p.experience !== 'number' || p.experience < 0 || isNaN(p.experience)) {
      errors.push(`Invalid player experience: ${p.experience}`);
    }
    if (typeof p.maxHealth !== 'number' || p.maxHealth <= 0) {
      errors.push(`Invalid player maxHealth: ${p.maxHealth}`);
    }
    if (typeof p.currentHealth !== 'number' || p.currentHealth < 0) {
      errors.push(`Invalid player currentHealth: ${p.currentHealth}`);
    }
    if (p.currentHealth > p.maxHealth) {
      errors.push(`currentHealth (${p.currentHealth}) cannot exceed maxHealth (${p.maxHealth})`);
    }

    if (!p.position || typeof p.position.x !== 'number' || typeof p.position.y !== 'number') {
      errors.push('Invalid or missing player coordinates');
    }
    if (!['up', 'down', 'left', 'right'].includes(p.facing as string)) {
      errors.push(`Invalid player facing direction: ${p.facing}`);
    }
  }

  // 5. Inventory validation
  if (!Array.isArray(s.inventory)) {
    errors.push('Inventory must be an array of slots');
  } else {
    for (let i = 0; i < s.inventory.length; i++) {
      const slot = s.inventory[i];
      if (!slot || typeof slot.slotIndex !== 'number') {
        errors.push(`Inventory slot at index ${i} is malformed`);
        continue;
      }
      if (slot.item) {
        const item = slot.item;
        if (!item.itemId || typeof item.itemId !== 'string') {
          errors.push(`Inventory item at slot ${i} has invalid itemId`);
          continue;
        }
        const itemDef = getItemDef(item.itemId);
        if (!itemDef) {
          errors.push(`Inventory item at slot ${i} references unknown itemId "${item.itemId}"`);
          continue;
        }
        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
          errors.push(`Inventory item "${item.itemId}" at slot ${i} has invalid quantity: ${item.quantity}`);
        } else if (item.quantity > itemDef.maxStackSize) {
          errors.push(
            `Inventory item "${item.itemId}" at slot ${i} exceeds maxStackSize (${item.quantity} > ${itemDef.maxStackSize})`
          );
        }
      }
    }
  }

  // 6. Equipment validation
  if (!s.equipment || typeof s.equipment !== 'object') {
    errors.push('Missing equipment state in snapshot');
  } else {
    const slots = ['weapon', 'head', 'body', 'accessory'] as const;
    for (const slotKey of slots) {
      const item = s.equipment[slotKey];
      if (item) {
        const itemDef = getItemDef(item.itemId);
        if (!itemDef) {
          errors.push(`Equipped item in ${slotKey} references unknown itemId "${item.itemId}"`);
        } else if (itemDef.slot !== slotKey) {
          errors.push(
            `Equipped item "${item.itemId}" with slot "${itemDef.slot}" cannot be equipped in "${slotKey}"`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}
