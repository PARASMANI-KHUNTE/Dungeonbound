export interface PlayerStatsBonus {
  readonly maxHealth: number;
  readonly attack: number;
  readonly defense: number;
}

export interface LevelUpResult {
  readonly oldLevel: number;
  readonly newLevel: number;
  readonly levelsGained: number;
  readonly didLevelUp: boolean;
  readonly totalXp: number;
  readonly currentLevelXp: number;
  readonly xpRequiredForNextLevel: number;
  readonly statBonus: PlayerStatsBonus;
}

/**
 * Total cumulative XP required to reach a specific level.
 * Level 1: 0
 * Level 2: 50
 * Level 3: 120
 * Level 4: 210
 * Level 5: 320
 * Level n: sum_{k=1}^{n-1} (30 + 20 * k)
 */
export function getCumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let k = 1; k < level; k++) {
    total += 30 + 20 * k;
  }
  return total;
}

/**
 * XP needed between level and level + 1.
 */
export function getXpDeltaForLevel(level: number): number {
  if (level < 1) return 50;
  return 30 + 20 * level;
}

/**
 * Determine level from total cumulative XP.
 */
export function calculateLevelFromTotalXp(totalXp: number): number {
  if (totalXp <= 0) return 1;
  let level = 1;
  while (true) {
    const nextLevelXp = getCumulativeXpForLevel(level + 1);
    if (totalXp >= nextLevelXp) {
      level += 1;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Stat increases per level above level 1.
 * +12 Max Health, +2 Attack, +1 Defense per level gained.
 */
export function calculateLevelStatBonuses(level: number): PlayerStatsBonus {
  const levelsAboveOne = Math.max(0, level - 1);
  return Object.freeze({
    maxHealth: levelsAboveOne * 12,
    attack: levelsAboveOne * 2,
    defense: levelsAboveOne * 1,
  });
}

/**
 * Add XP to current progression state and evaluate level-ups.
 * Gracefully handles multi-level jumps when large XP amounts are awarded.
 */
export function addExperience(
  currentLevel: number,
  currentTotalXp: number,
  xpToAdd: number
): LevelUpResult {
  const safeXpToAdd = Math.max(0, xpToAdd);
  const newTotalXp = currentTotalXp + safeXpToAdd;
  const newLevel = calculateLevelFromTotalXp(newTotalXp);
  const levelsGained = Math.max(0, newLevel - currentLevel);
  const didLevelUp = levelsGained > 0;

  const currentLevelBaseXp = getCumulativeXpForLevel(newLevel);
  const nextLevelTotalXp = getCumulativeXpForLevel(newLevel + 1);
  const currentLevelXp = newTotalXp - currentLevelBaseXp;
  const xpRequiredForNextLevel = nextLevelTotalXp - currentLevelBaseXp;

  const statBonus = calculateLevelStatBonuses(newLevel);

  return Object.freeze({
    oldLevel: currentLevel,
    newLevel,
    levelsGained,
    didLevelUp,
    totalXp: newTotalXp,
    currentLevelXp,
    xpRequiredForNextLevel,
    statBonus,
  });
}
