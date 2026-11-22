import { Direction } from '../value-objects/Transform';
import { Vector2, createVector2, normalizeVector } from '../value-objects/Vector2';

export interface AttackDefinition {
  readonly id: string;
  readonly damageMultiplier: number;
  readonly startupMs: number; // Wind-up before hit window
  readonly activeMs: number; // Active hit window
  readonly recoveryMs: number; // Post-hit recovery before return to idle
  readonly cooldownMs: number;
  readonly range: number; // Reach ahead of attacker
  readonly hitboxWidth: number; // Width perpendicular to facing
  readonly knockback: number; // Knockback distance in world units
}

export const DEFAULT_PLAYER_ATTACK: AttackDefinition = Object.freeze({
  id: 'basic_sword_slash',
  damageMultiplier: 1.0,
  startupMs: 70,
  activeMs: 140,
  recoveryMs: 110,
  cooldownMs: 380,
  range: 42,
  hitboxWidth: 48,
  knockback: 28,
});

export const DEFAULT_ENEMY_ATTACK: AttackDefinition = Object.freeze({
  id: 'goblin_slash',
  damageMultiplier: 1.0,
  startupMs: 220,
  activeMs: 150,
  recoveryMs: 250,
  cooldownMs: 1200,
  range: 34,
  hitboxWidth: 36,
  knockback: 18,
});

export interface HitboxRect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function calculateAttackHitbox(
  attackerPos: Vector2,
  facing: Direction,
  range: number,
  width: number
): HitboxRect {
  const halfWidth = width / 2;

  switch (facing) {
    case 'up':
      return {
        minX: attackerPos.x - halfWidth,
        maxX: attackerPos.x + halfWidth,
        minY: attackerPos.y - range,
        maxY: attackerPos.y,
      };
    case 'down':
      return {
        minX: attackerPos.x - halfWidth,
        maxX: attackerPos.x + halfWidth,
        minY: attackerPos.y,
        maxY: attackerPos.y + range,
      };
    case 'left':
      return {
        minX: attackerPos.x - range,
        maxX: attackerPos.x,
        minY: attackerPos.y - halfWidth,
        maxY: attackerPos.y + halfWidth,
      };
    case 'right':
      return {
        minX: attackerPos.x,
        maxX: attackerPos.x + range,
        minY: attackerPos.y - halfWidth,
        maxY: attackerPos.y + halfWidth,
      };
  }
}

export function isTargetInsideHitbox(
  targetPos: Vector2,
  targetRadius: number,
  hitbox: HitboxRect
): boolean {
  return (
    targetPos.x + targetRadius >= hitbox.minX &&
    targetPos.x - targetRadius <= hitbox.maxX &&
    targetPos.y + targetRadius >= hitbox.minY &&
    targetPos.y - targetRadius <= hitbox.maxY
  );
}

export function calculateDamage(
  attackerPower: number,
  defenderDefense: number,
  multiplier = 1.0
): number {
  const raw = attackerPower * multiplier - Math.floor(defenderDefense * 0.5);
  return Math.max(1, Math.floor(raw));
}

export function calculateKnockbackPosition(
  fromPos: Vector2,
  toPos: Vector2,
  knockbackDistance: number
): Vector2 {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const dir = normalizeVector(createVector2(dx, dy));
  if (dir.x === 0 && dir.y === 0) {
    return createVector2(toPos.x, toPos.y + knockbackDistance);
  }
  return createVector2(
    toPos.x + dir.x * knockbackDistance,
    toPos.y + dir.y * knockbackDistance
  );
}
