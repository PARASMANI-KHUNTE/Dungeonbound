import {
  addExperience,
  calculateLevelFromTotalXp,
  calculateLevelStatBonuses,
  getCumulativeXpForLevel,
  getXpDeltaForLevel,
} from '../../src/game/domain/rules/ProgressionRules';

describe('ProgressionRules', () => {
  describe('XP thresholds and level calculations', () => {
    it('calculates correct cumulative XP thresholds', () => {
      expect(getCumulativeXpForLevel(1)).toBe(0);
      expect(getCumulativeXpForLevel(2)).toBe(50); // 30 + 20*1 = 50
      expect(getCumulativeXpForLevel(3)).toBe(120); // 50 + 30 + 20*2 = 120
      expect(getCumulativeXpForLevel(4)).toBe(210); // 120 + 30 + 20*3 = 210
    });

    it('calculates correct level from cumulative total XP', () => {
      expect(calculateLevelFromTotalXp(0)).toBe(1);
      expect(calculateLevelFromTotalXp(49)).toBe(1);
      expect(calculateLevelFromTotalXp(50)).toBe(2);
      expect(calculateLevelFromTotalXp(119)).toBe(2);
      expect(calculateLevelFromTotalXp(120)).toBe(3);
      expect(calculateLevelFromTotalXp(350)).toBe(5);
    });

    it('calculates delta XP between levels', () => {
      expect(getXpDeltaForLevel(1)).toBe(50);
      expect(getXpDeltaForLevel(2)).toBe(70);
      expect(getXpDeltaForLevel(3)).toBe(90);
    });
  });

  describe('Stat bonuses per level', () => {
    it('provides zero bonus at level 1', () => {
      const bonus = calculateLevelStatBonuses(1);
      expect(bonus.maxHealth).toBe(0);
      expect(bonus.attack).toBe(0);
      expect(bonus.defense).toBe(0);
    });

    it('provides scaled bonuses above level 1', () => {
      const bonusLvl2 = calculateLevelStatBonuses(2);
      expect(bonusLvl2.maxHealth).toBe(12);
      expect(bonusLvl2.attack).toBe(2);
      expect(bonusLvl2.defense).toBe(1);

      const bonusLvl5 = calculateLevelStatBonuses(5);
      expect(bonusLvl5.maxHealth).toBe(48); // 4 * 12
      expect(bonusLvl5.attack).toBe(8); // 4 * 2
      expect(bonusLvl5.defense).toBe(4); // 4 * 1
    });
  });

  describe('addExperience (Acceptance Criteria)', () => {
    it('handles normal progression within current level', () => {
      const res = addExperience(1, 0, 30);
      expect(res.didLevelUp).toBe(false);
      expect(res.newLevel).toBe(1);
      expect(res.levelsGained).toBe(0);
      expect(res.totalXp).toBe(30);
      expect(res.currentLevelXp).toBe(30);
      expect(res.xpRequiredForNextLevel).toBe(50);
    });

    it('handles single level up when threshold is met', () => {
      const res = addExperience(1, 30, 20); // total 50
      expect(res.didLevelUp).toBe(true);
      expect(res.newLevel).toBe(2);
      expect(res.levelsGained).toBe(1);
      expect(res.totalXp).toBe(50);
      expect(res.currentLevelXp).toBe(0);
      expect(res.xpRequiredForNextLevel).toBe(70);
      expect(res.statBonus.attack).toBe(2);
      expect(res.statBonus.defense).toBe(1);
    });

    it('handles rewards crossing MORE THAN ONE LEVEL (Multi-level jump)', () => {
      // Level 1 (0 XP) + 350 XP -> Level 5 (320 XP) with 30 rollover XP
      const res = addExperience(1, 0, 350);
      expect(res.didLevelUp).toBe(true);
      expect(res.newLevel).toBe(5);
      expect(res.levelsGained).toBe(4);
      expect(res.totalXp).toBe(350);
      expect(res.currentLevelXp).toBe(30); // 350 - 320 = 30
      expect(res.statBonus.maxHealth).toBe(48);
      expect(res.statBonus.attack).toBe(8);
      expect(res.statBonus.defense).toBe(4);
    });

    it('ignores negative or zero XP additions', () => {
      const res = addExperience(2, 60, 0);
      expect(res.didLevelUp).toBe(false);
      expect(res.newLevel).toBe(2);
      expect(res.totalXp).toBe(60);

      const resNeg = addExperience(2, 60, -50);
      expect(resNeg.totalXp).toBe(60);
      expect(resNeg.newLevel).toBe(2);
    });
  });
});
