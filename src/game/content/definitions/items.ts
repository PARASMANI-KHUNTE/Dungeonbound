import { ItemDefinition } from '../../domain/items/ItemTypes';

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  // Consumables
  health_potion_small: {
    id: 'health_potion_small',
    name: 'Small Health Potion',
    description: 'A modest herbal vial that restores 35 HP.',
    type: 'consumable',
    rarity: 'common',
    maxStackSize: 20,
    useEffect: { type: 'HEAL', amount: 35 },
  },
  health_potion_large: {
    id: 'health_potion_large',
    name: 'Large Health Potion',
    description: 'A potent concoction that restores 80 HP.',
    type: 'consumable',
    rarity: 'uncommon',
    maxStackSize: 10,
    useEffect: { type: 'HEAL', amount: 80 },
  },

  // Weapons
  rusty_sword: {
    id: 'rusty_sword',
    name: 'Rusty Sword',
    description: 'An old iron sword with a nicked edge. Adds +3 Attack.',
    type: 'weapon',
    rarity: 'common',
    slot: 'weapon',
    maxStackSize: 1,
    statModifiers: { attack: 3 },
  },
  iron_broadsword: {
    id: 'iron_broadsword',
    name: 'Iron Broadsword',
    description: 'A sturdy double-edged blade forged in the village smithy. Adds +8 Attack, +2% Crit.',
    type: 'weapon',
    rarity: 'uncommon',
    slot: 'weapon',
    maxStackSize: 1,
    statModifiers: { attack: 8, criticalChance: 0.02 },
  },
  silver_rapier: {
    id: 'silver_rapier',
    name: 'Silver Rapier',
    description: 'A finely balanced, gleaming rapier. Adds +14 Attack, +5% Crit.',
    type: 'weapon',
    rarity: 'rare',
    slot: 'weapon',
    maxStackSize: 1,
    statModifiers: { attack: 14, criticalChance: 0.05 },
  },

  // Headgear
  leather_cap: {
    id: 'leather_cap',
    name: 'Leather Cap',
    description: 'Supple stitched leather headwear. Adds +1 Defense, +5 Max HP.',
    type: 'armor',
    rarity: 'common',
    slot: 'head',
    maxStackSize: 1,
    statModifiers: { defense: 1, maxHealth: 5 },
  },
  iron_helmet: {
    id: 'iron_helmet',
    name: 'Iron Helmet',
    description: 'A heavy visage offering solid skull protection. Adds +3 Defense, +15 Max HP.',
    type: 'armor',
    rarity: 'uncommon',
    slot: 'head',
    maxStackSize: 1,
    statModifiers: { defense: 3, maxHealth: 15 },
  },

  // Armor / Body
  cloth_tunic: {
    id: 'cloth_tunic',
    name: 'Cloth Tunic',
    description: 'A simple padded cloth tunic. Adds +2 Defense, +10 Max HP.',
    type: 'armor',
    rarity: 'common',
    slot: 'body',
    maxStackSize: 1,
    statModifiers: { defense: 2, maxHealth: 10 },
  },
  iron_chainmail: {
    id: 'iron_chainmail',
    name: 'Iron Chainmail',
    description: 'Interlocking metal rings that blunt slashing blows. Adds +6 Defense, +30 Max HP.',
    type: 'armor',
    rarity: 'uncommon',
    slot: 'body',
    maxStackSize: 1,
    statModifiers: { defense: 6, maxHealth: 30 },
  },

  // Accessories
  bronze_ring: {
    id: 'bronze_ring',
    name: 'Bronze Ring',
    description: 'An engraved bronze band. Adds +1 Attack, +1 Defense.',
    type: 'accessory',
    rarity: 'common',
    slot: 'accessory',
    maxStackSize: 1,
    statModifiers: { attack: 1, defense: 1 },
  },
  wind_talisman: {
    id: 'wind_talisman',
    name: 'Wind Talisman',
    description: 'Infused with gentle zephyrs. Adds +20 Movement Speed.',
    type: 'accessory',
    rarity: 'uncommon',
    slot: 'accessory',
    maxStackSize: 1,
    statModifiers: { moveSpeed: 20 },
  },
};

export function getItemDefinition(itemId: string): ItemDefinition | undefined {
  return ITEM_DEFINITIONS[itemId];
}
