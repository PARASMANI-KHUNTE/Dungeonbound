import {
  EnemyState,
  createEnemyEntity,
  updateEnemy,
} from '@/game/domain/entities/EnemyEntity';
import { updateEnemyAI } from '@/game/domain/rules/EnemyAIRules';
import { createVector2 } from '@/game/domain/value-objects/Vector2';

describe('EnemyAIRules', () => {
  const spawnPos = createVector2(200, 200);

  it('transitions from idle to chase when player enters aggro radius', () => {
    const enemy = createEnemyEntity('goblin_1', 'goblin_scout', spawnPos);
    // Player inside aggro radius (dist = 100 < 180)
    const playerPos = createVector2(200, 100);

    const result = updateEnemyAI(enemy, playerPos, 0.1);
    expect(result.updatedEnemy.state).toBe('chase');
    expect(result.intendedMovement.y).toBeLessThan(0); // moves upward toward player
    expect(result.updatedEnemy.transform.facing).toBe('up');
  });

  it('transitions to attack when player is within attack range and cooldown ready', () => {
    const enemy = createEnemyEntity('goblin_1', 'goblin_scout', spawnPos);
    // Player within attack range (dist = 25 <= 34)
    const playerPos = createVector2(225, 200);

    const result = updateEnemyAI(enemy, playerPos, 0.1);
    expect(result.updatedEnemy.state).toBe('attack');
    expect(result.updatedEnemy.transform.facing).toBe('right');
  });

  it('does not act or move when dead', () => {
    const enemy = createEnemyEntity('goblin_dead', 'goblin_scout', spawnPos, 'down', {
      maxHealth: 0,
    });

    const result = updateEnemyAI(enemy, createVector2(200, 210), 0.1);
    expect(result.updatedEnemy.state).toBe('dead');
    expect(result.intendedMovement).toEqual({ x: 0, y: 0 });
    expect(result.shouldTriggerAttackHit).toBe(false);
  });

  it('cannot start an attack while its attack cooldown is active', () => {
    const enemy = updateEnemy(createEnemyEntity('goblin_1', 'goblin_scout', spawnPos), {
      attackCooldownRemainingMs: 800,
    });
    const playerPos = createVector2(225, 200); // within attack range (25 <= 34)

    const result = updateEnemyAI(enemy, playerPos, 0.1);
    expect(result.updatedEnemy.state).toBe('chase');
    expect(result.updatedEnemy.attackCooldownRemainingMs).toBe(700);
    expect(result.shouldTriggerAttackHit).toBe(false);
  });

  it('normalizes an invalid state to idle without allowing an attack', () => {
    const enemy = updateEnemy(createEnemyEntity('goblin_1', 'goblin_scout', spawnPos), {
      state: 'corrupted' as unknown as EnemyState,
    });

    const result = updateEnemyAI(enemy, createVector2(200, 100), 0.1);
    expect(result.updatedEnemy.state).toBe('idle');
    expect(result.shouldTriggerAttackHit).toBe(false);
    expect(result.intendedMovement).toEqual({ x: 0, y: 0 });
  });

  it('triggers the attack hit only once while crossing the active window', () => {
    let enemy = updateEnemy(createEnemyEntity('goblin_1', 'goblin_scout', spawnPos), {
      state: 'attack',
      stateTimerMs: 0,
    });
    const farAwayPlayer = createVector2(600, 600);
    let hitCount = 0;

    // 40 steps of 1/60s (~667ms) covers the full 620ms attack.
    for (let i = 0; i < 40; i++) {
      const result = updateEnemyAI(enemy, farAwayPlayer, 1 / 60);
      if (result.shouldTriggerAttackHit) hitCount++;
      enemy = result.updatedEnemy;
    }

    expect(hitCount).toBe(1);
    expect(enemy.state).toBe('idle');
  });
});
