import {
  calculateAttackHitbox,
  calculateDamage,
  calculateKnockbackPosition,
  isTargetInsideHitbox,
} from '@/game/domain/rules/CombatRules';
import { createVector2 } from '@/game/domain/value-objects/Vector2';

describe('CombatRules', () => {
  const origin = createVector2(100, 100);

  it('calculates directional attack hitboxes correctly', () => {
    // Up: reaches above attacker (y - range to y)
    const upHitbox = calculateAttackHitbox(origin, 'up', 40, 30);
    expect(upHitbox.minY).toBe(60);
    expect(upHitbox.maxY).toBe(100);
    expect(upHitbox.minX).toBe(85);
    expect(upHitbox.maxX).toBe(115);

    // Down: reaches below attacker (y to y + range)
    const downHitbox = calculateAttackHitbox(origin, 'down', 40, 30);
    expect(downHitbox.minY).toBe(100);
    expect(downHitbox.maxY).toBe(140);

    // Right: reaches right of attacker (x to x + range)
    const rightHitbox = calculateAttackHitbox(origin, 'right', 50, 40);
    expect(rightHitbox.minX).toBe(100);
    expect(rightHitbox.maxX).toBe(150);

    // Left: reaches left of attacker (x - range to x)
    const leftHitbox = calculateAttackHitbox(origin, 'left', 50, 40);
    expect(leftHitbox.minX).toBe(50);
    expect(leftHitbox.maxX).toBe(100);
  });

  it('detects targets within the active hitbox', () => {
    const hitbox = calculateAttackHitbox(origin, 'right', 40, 30);
    // Target in front of attacker
    expect(isTargetInsideHitbox(createVector2(120, 100), 10, hitbox)).toBe(true);
    // Target behind attacker
    expect(isTargetInsideHitbox(createVector2(70, 100), 10, hitbox)).toBe(false);
  });

  it('calculates damage with defense reduction and minimum 1 damage invariant', () => {
    // Attack 15, Defense 6 -> 15 - 3 = 12
    expect(calculateDamage(15, 6, 1.0)).toBe(12);

    // High defense: Attack 5, Defense 40 -> max(1, 5 - 20) = 1
    expect(calculateDamage(5, 40, 1.0)).toBe(1);
  });

  it('computes knockback position away from attacker', () => {
    const attacker = createVector2(100, 100);
    const defender = createVector2(120, 100);

    const knockbackPos = calculateKnockbackPosition(attacker, defender, 30);
    expect(knockbackPos.x).toBeCloseTo(150, 1);
    expect(knockbackPos.y).toBeCloseTo(100, 1);
  });
});
