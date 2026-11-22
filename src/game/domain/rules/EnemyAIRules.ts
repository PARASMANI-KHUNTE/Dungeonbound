import { EnemyEntity, updateEnemy } from '../entities/EnemyEntity';
import { calculateFacingDirection } from './MovementRules';
import { DEFAULT_ENEMY_ATTACK } from './CombatRules';
import { createTransform } from '../value-objects/Transform';
import {
  Vector2,
  createVector2,
  distanceBetween,
  normalizeVector,
  scaleVector,
} from '../value-objects/Vector2';

export interface EnemyAIUpdateResult {
  readonly updatedEnemy: EnemyEntity;
  readonly shouldTriggerAttackHit: boolean;
  readonly intendedMovement: Vector2;
}

export const ENEMY_HURT_DURATION_MS = 220;

export function updateEnemyAI(
  enemy: EnemyEntity,
  playerPosition: Vector2,
  deltaSeconds: number
): EnemyAIUpdateResult {
  const deltaMs = deltaSeconds * 1000;

  // 1. Dead state: remain dead, no action
  if (enemy.currentHealth <= 0 || enemy.state === 'dead') {
    return {
      updatedEnemy: enemy.state === 'dead' ? enemy : updateEnemy(enemy, { state: 'dead' }),
      shouldTriggerAttackHit: false,
      intendedMovement: createVector2(0, 0),
    };
  }

  // Decrement cooldown if any
  const nextCooldown = Math.max(0, enemy.attackCooldownRemainingMs - deltaMs);

  // 2. Hurt state: lock movement, transition out when timer expires
  if (enemy.state === 'hurt') {
    const nextTimer = enemy.stateTimerMs + deltaMs;
    if (nextTimer >= ENEMY_HURT_DURATION_MS) {
      return {
        updatedEnemy: updateEnemy(enemy, {
          state: 'idle',
          stateTimerMs: 0,
          attackCooldownRemainingMs: nextCooldown,
        }),
        shouldTriggerAttackHit: false,
        intendedMovement: createVector2(0, 0),
      };
    }
    return {
      updatedEnemy: updateEnemy(enemy, {
        stateTimerMs: nextTimer,
        attackCooldownRemainingMs: nextCooldown,
      }),
      shouldTriggerAttackHit: false,
      intendedMovement: createVector2(0, 0),
    };
  }

  // 3. Attack state: wind-up, hit window, recovery
  if (enemy.state === 'attack') {
    const totalAttackDuration =
      DEFAULT_ENEMY_ATTACK.startupMs +
      DEFAULT_ENEMY_ATTACK.activeMs +
      DEFAULT_ENEMY_ATTACK.recoveryMs;

    const prevTimer = enemy.stateTimerMs;
    const nextTimer = prevTimer + deltaMs;

    // Trigger hit once during the transition into the active window
    const hitWindowStart = DEFAULT_ENEMY_ATTACK.startupMs;
    const hitWindowEnd = DEFAULT_ENEMY_ATTACK.startupMs + DEFAULT_ENEMY_ATTACK.activeMs;
    const shouldTriggerHit =
      prevTimer < hitWindowStart && nextTimer >= hitWindowStart && nextTimer <= hitWindowEnd;

    if (nextTimer >= totalAttackDuration) {
      // Return to idle with cooldown
      return {
        updatedEnemy: updateEnemy(enemy, {
          state: 'idle',
          stateTimerMs: 0,
          attackCooldownRemainingMs: DEFAULT_ENEMY_ATTACK.cooldownMs,
        }),
        shouldTriggerAttackHit: shouldTriggerHit,
        intendedMovement: createVector2(0, 0),
      };
    }

    return {
      updatedEnemy: updateEnemy(enemy, {
        stateTimerMs: nextTimer,
        attackCooldownRemainingMs: nextCooldown,
      }),
      shouldTriggerAttackHit: shouldTriggerHit,
      intendedMovement: createVector2(0, 0),
    };
  }

  // 4. Defensive guard: only idle/chase may evaluate movement and attacks.
  // A corrupted or future state must never silently fall through into an attack.
  if (enemy.state !== 'idle' && enemy.state !== 'chase') {
    return {
      updatedEnemy: updateEnemy(enemy, {
        state: 'idle',
        stateTimerMs: 0,
        attackCooldownRemainingMs: nextCooldown,
      }),
      shouldTriggerAttackHit: false,
      intendedMovement: createVector2(0, 0),
    };
  }

  // 5. Idle or Chase states: evaluate distance to player
  const distToPlayer = distanceBetween(enemy.transform.position, playerPosition);
  const dx = playerPosition.x - enemy.transform.position.x;
  const dy = playerPosition.y - enemy.transform.position.y;
  const dirToPlayer = normalizeVector(createVector2(dx, dy));
  const facingToPlayer = calculateFacingDirection(dirToPlayer, enemy.transform.facing);

  // Check if ready to attack
  if (distToPlayer <= enemy.stats.attackRange && nextCooldown <= 0) {
    return {
      updatedEnemy: updateEnemy(enemy, {
        state: 'attack',
        stateTimerMs: 0,
        attackCooldownRemainingMs: nextCooldown,
        transform: createTransform(enemy.transform.position, facingToPlayer),
      }),
      shouldTriggerAttackHit: false,
      intendedMovement: createVector2(0, 0),
    };
  }

  // Check if player is inside aggro radius
  if (distToPlayer <= enemy.stats.aggroRadius) {
    const moveVelocity = scaleVector(dirToPlayer, enemy.stats.moveSpeed);
    return {
      updatedEnemy: updateEnemy(enemy, {
        state: 'chase',
        stateTimerMs: 0,
        attackCooldownRemainingMs: nextCooldown,
        transform: createTransform(enemy.transform.position, facingToPlayer),
      }),
      shouldTriggerAttackHit: false,
      intendedMovement: moveVelocity,
    };
  }

  // Otherwise return to idle
  return {
    updatedEnemy: updateEnemy(enemy, {
      state: 'idle',
      stateTimerMs: 0,
      attackCooldownRemainingMs: nextCooldown,
    }),
    shouldTriggerAttackHit: false,
    intendedMovement: createVector2(0, 0),
  };
}
