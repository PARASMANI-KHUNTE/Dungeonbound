import { createEnemyEntity } from '@/game/domain/entities/EnemyEntity';
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
});
