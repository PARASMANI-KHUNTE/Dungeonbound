import { createEnemyEntity, updateEnemy } from '@/game/domain/entities/EnemyEntity';
import {
  DEFAULT_PLAYER_ATTACK,
  calculateDamage,
} from '@/game/domain/rules/CombatRules';
import { createVector2 } from '@/game/domain/value-objects/Vector2';
import { GameRuntime } from '@/game/engine/GameRuntime';
import { parseTileMap } from '@/game/world/TileMapParser';

describe('Combat Integration', () => {
  const testMap = parseTileMap({
    id: 'combat_test_map',
    width: 25,
    height: 20,
    tilewidth: 32,
    tileheight: 32,
    spawnPoint: { x: 260, y: 220 }, // Spawn directly next to goblin_1 at (260, 220)
    layers: [
      {
        name: 'Ground',
        data: new Array(500).fill(1),
      },
    ],
  });

  it('allows player to attack, damage, and defeat an enemy', () => {
    const runtime = new GameRuntime('combat_slot', testMap, 400, 300);
    runtime.start(() => 0);

    // Player starts at (260, 220). Position goblin right in front (280, 220), facing right.
    const initialEnemyHealth = runtime.currentSession.enemies.get('goblin_1')!.currentHealth;
    expect(initialEnemyHealth).toBe(40);

    // Face player right towards the goblin
    runtime.input.setMovement(1, 0);
    runtime.fixedUpdate(1 / 60);
    runtime.input.setMovement(0, 0);

    // Player attacks
    const attackStarted = runtime.triggerPlayerAttack();
    expect(attackStarted).toBe(true);

    // Advance simulation through attack startup (70ms) and active window
    // 6 steps of 1/60s = 100ms
    for (let i = 0; i < 6; i++) {
      runtime.fixedUpdate(1 / 60);
    }

    const damagedEnemy = runtime.currentSession.enemies.get('goblin_1')!;
    // Damage applied
    expect(damagedEnemy.currentHealth).toBeLessThan(initialEnemyHealth);
    expect(damagedEnemy.state).toBe('hurt');

    // Events emitted
    const events = runtime.currentSession.eventQueue;
    const damageEvent = events.find((e) => e.type === 'ENEMY_DAMAGED');
    expect(damageEvent).toBeDefined();

    runtime.dispose();
  });

  it('triggers enemy defeat event when health reaches 0 and prevents dead enemies from acting', () => {
    const runtime = new GameRuntime('combat_slot', testMap, 400, 300);
    runtime.start(() => 0);

    const goblin = runtime.currentSession.enemies.get('goblin_1')!;
    // Set health to 1 so the next attack defeats it
    runtime.currentSession.enemies.set('goblin_1', {
      ...goblin,
      currentHealth: 1,
    });

    runtime.input.setMovement(1, 0);
    runtime.fixedUpdate(1 / 60);
    runtime.input.setMovement(0, 0);

    runtime.triggerPlayerAttack();

    for (let i = 0; i < 10; i++) {
      runtime.fixedUpdate(1 / 60);
    }

    const deadGoblin = runtime.currentSession.enemies.get('goblin_1')!;
    expect(deadGoblin.currentHealth).toBe(0);
    expect(deadGoblin.state).toBe('dead');

    const defeatEvent = runtime.currentSession.eventQueue.find(
      (e) => e.type === 'ENEMY_DEFEATED'
    );
    expect(defeatEvent).toBeDefined();

    // Dead enemy does not move or act on further updates
    const deadPos = { ...deadGoblin.transform.position };
    for (let i = 0; i < 20; i++) {
      runtime.fixedUpdate(1 / 60);
    }
    expect(runtime.currentSession.enemies.get('goblin_1')!.transform.position).toEqual(deadPos);

    runtime.dispose();
  });

  it('handles player death and respawn flow cleanly', () => {
    const runtime = new GameRuntime('combat_slot', testMap, 400, 300);
    runtime.start(() => 0);

    // Apply lethal damage to player
    runtime.damagePlayer(runtime.currentSession.player.stats.maxHealth);

    const proj = runtime.createProjection();
    expect(proj.player.isDead).toBe(true);
    expect(proj.player.currentHealth).toBe(0);

    const deathEvent = runtime.currentSession.eventQueue.find((e) => e.type === 'PLAYER_DIED');
    expect(deathEvent).toBeDefined();

    // Respawn player
    runtime.respawnPlayer();

    const respawnedProj = runtime.createProjection();
    expect(respawnedProj.player.isDead).toBe(false);
    expect(respawnedProj.player.currentHealth).toBe(respawnedProj.player.maxHealth);
    expect(respawnedProj.player.position).toEqual(testMap.spawnPoint);

    runtime.dispose();
  });

  it('hits each enemy at most once per attack instance', () => {
    const runtime = new GameRuntime('one_hit_slot', testMap, 400, 300);
    runtime.start(() => 0);
    runtime.currentSession.enemies.clear();

    // Player spawns at (260, 220) facing down; both enemies sit inside the
    // 42-unit-long, 48-wide hitbox.
    const goblinA = createEnemyEntity('goblin_a', 'goblin_scout', createVector2(250, 240));
    const goblinB = createEnemyEntity('goblin_b', 'goblin_scout', createVector2(270, 240));
    runtime.currentSession.enemies.set('goblin_a', goblinA);
    runtime.currentSession.enemies.set('goblin_b', goblinB);
    expect(runtime.currentSession.player.transform.facing).toBe('down');

    runtime.triggerPlayerAttack();
    // Stay inside the active window (startup 70ms, active 140ms).
    for (let i = 0; i < 8; i++) runtime.fixedUpdate(1 / 60);

    const damageEvents = runtime.currentSession.eventQueue.filter(
      (e) => e.type === 'ENEMY_DAMAGED'
    );
    expect(damageEvents).toHaveLength(2);
    expect(damageEvents.map((e) => (e as { enemyId: string }).enemyId).sort()).toEqual([
      'goblin_a',
      'goblin_b',
    ]);

    const expectedDamage = calculateDamage(
      runtime.currentSession.player.derivedStats.attack,
      goblinA.stats.defense,
      DEFAULT_PLAYER_ATTACK.damageMultiplier
    );
    expect(runtime.currentSession.enemies.get('goblin_a')!.currentHealth).toBe(
      goblinA.stats.maxHealth - expectedDamage
    );
    expect(runtime.currentSession.enemies.get('goblin_b')!.currentHealth).toBe(
      goblinB.stats.maxHealth - expectedDamage
    );

    runtime.dispose();
  });

  it('does not damage the player again while player i-frames are active', () => {
    const runtime = new GameRuntime('iframe_slot', testMap, 400, 300);
    runtime.start(() => 0);
    runtime.currentSession.enemies.clear();

    // Enemy directly below the player, one step before the active hit window.
    runtime.currentSession.enemies.set(
      'goblin_a',
      updateEnemy(createEnemyEntity('goblin_a', 'goblin_scout', createVector2(260, 240)), {
        state: 'attack',
        stateTimerMs: 210,
      })
    );
    Object.assign(runtime.currentSession, { playerInvulnerableUntilMs: 1000 });

    for (let i = 0; i < 4; i++) runtime.fixedUpdate(1 / 60);

    expect(runtime.currentSession.player.currentHealth).toBe(
      runtime.currentSession.player.derivedStats.maxHealth
    );
    expect(runtime.currentSession.eventQueue.some((e) => e.type === 'PLAYER_DAMAGED')).toBe(false);

    runtime.dispose();
  });
});
