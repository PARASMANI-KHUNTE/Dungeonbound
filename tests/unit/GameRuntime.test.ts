import { GameRuntime } from '@/game/engine/GameRuntime';
import { parseTileMap } from '@/game/world/TileMapParser';

describe('GameRuntime', () => {
  const testMap = parseTileMap({
    id: 'runtime_test_map',
    width: 20,
    height: 15,
    tilewidth: 32,
    tileheight: 32,
    spawnPoint: { x: 320, y: 240 },
    layers: [
      {
        name: 'Ground',
        data: new Array(300).fill(1),
      },
    ],
  });

  it('initializes lifecycle with correct spawn location and projection', () => {
    const runtime = new GameRuntime('test_slot', testMap, 400, 300);

    expect(runtime.isRunning).toBe(false);
    expect(runtime.isPaused).toBe(false);

    const proj = runtime.createProjection();
    expect(proj.player.position.x).toBe(320);
    expect(proj.player.position.y).toBe(240);
    expect(proj.map.id).toBe('runtime_test_map');

    runtime.dispose();
  });

  it('moves player and updates camera on fixedUpdate', () => {
    const runtime = new GameRuntime('test_slot', testMap, 400, 300);
    runtime.start(() => 0);

    // Command player to move right
    runtime.input.setMovement(1, 0);

    // Run 1 second of simulation (60 steps of 1/60s)
    for (let i = 0; i < 60; i++) {
      runtime.fixedUpdate(1 / 60);
    }

    const proj = runtime.createProjection();
    // Default speed is 120 units/s, moved 1 second -> approx x: 320 + 120 = 440
    expect(proj.player.position.x).toBeCloseTo(440, 1);
    expect(proj.player.position.y).toBe(240);
    expect(proj.player.facing).toBe('right');

    // Camera follows player position
    expect(proj.camera.position.x).toBeCloseTo(440, 1);

    runtime.dispose();
  });

  it('resets held input when paused or stopped', () => {
    const runtime = new GameRuntime('test_slot', testMap, 400, 300);

    runtime.input.setMovement(1, 1);
    runtime.input.setAttacking(true);
    runtime.pause();
    expect(runtime.input.readSnapshot()).toMatchObject({
      moveVector: { x: 0, y: 0 },
      isAttacking: false,
    });

    runtime.input.setMovement(-1, 0);
    runtime.input.setDodging(true);
    runtime.stop();
    expect(runtime.input.readSnapshot()).toMatchObject({
      moveVector: { x: 0, y: 0 },
      isDodging: false,
    });

    runtime.dispose();
  });

  it('notifies projection subscribers when active', () => {
    const runtime = new GameRuntime('test_slot', testMap, 400, 300);
    const projections: any[] = [];

    const unsubscribe = runtime.subscribe((p) => projections.push(p));

    // Immediate initial projection received
    expect(projections.length).toBe(1);

    runtime.pause();
    expect(projections.length).toBe(2);
    expect(projections[1].stats.isPaused).toBe(true);

    unsubscribe();
    runtime.resume();
    // No more updates sent to unsubscribed listener
    expect(projections.length).toBe(2);

    runtime.dispose();
  });

  it('blocks a second attack during cooldown and allows it again once the cooldown elapses', () => {
    const runtime = new GameRuntime('test_slot', testMap, 400, 300);
    runtime.start(() => 0);
    runtime.currentSession.enemies.clear();

    expect(runtime.triggerPlayerAttack()).toBe(true);
    // The attack is still in progress, so a second trigger is rejected.
    expect(runtime.triggerPlayerAttack()).toBe(false);

    // Full attack is 70 + 140 + 110 = 320ms; 20 steps of 16ms covers it.
    for (let i = 0; i < 20; i++) runtime.fixedUpdate(16 / 1000);
    expect(runtime.currentSession.playerAttackTimerMs).toBe(0);
    expect(runtime.currentSession.playerAttackCooldownMs).toBeGreaterThan(0);
    expect(runtime.triggerPlayerAttack()).toBe(false);

    // Cooldown is 380ms; 24 steps of 16ms (384ms) clears it.
    for (let i = 0; i < 24; i++) runtime.fixedUpdate(16 / 1000);
    expect(runtime.currentSession.playerAttackCooldownMs).toBe(0);
    expect(runtime.triggerPlayerAttack()).toBe(true);

    runtime.dispose();
  });

  it('pauses on player death, freezes elapsed time, and resumes on respawn', () => {
    const runtime = new GameRuntime('test_slot', testMap, 400, 300);
    runtime.start(() => 0);
    runtime.currentSession.enemies.clear();

    for (let i = 0; i < 10; i++) runtime.fixedUpdate(1 / 60);
    const timeAtDeath = runtime.currentSession.elapsedTimeSeconds;
    expect(timeAtDeath).toBeGreaterThan(0);

    runtime.damagePlayer(runtime.currentSession.player.stats.maxHealth);

    expect(runtime.isPaused).toBe(true);
    expect(runtime.currentSession.player.animation.state).toBe('dead');
    expect(runtime.createProjection().player.isDead).toBe(true);

    // Further updates are ignored while the death modal is shown.
    for (let i = 0; i < 20; i++) runtime.fixedUpdate(1 / 60);
    expect(runtime.currentSession.elapsedTimeSeconds).toBe(timeAtDeath);

    runtime.respawnPlayer();

    expect(runtime.isPaused).toBe(false);
    expect(runtime.currentSession.player.currentHealth).toBe(
      runtime.currentSession.player.derivedStats.maxHealth
    );
    const timeAfterRespawn = runtime.currentSession.elapsedTimeSeconds;
    runtime.fixedUpdate(1 / 60);
    expect(runtime.currentSession.elapsedTimeSeconds).toBeGreaterThan(timeAfterRespawn);

    runtime.dispose();
  });

  it('forwards combat events to the injected feedback port', () => {
    const played: string[] = [];
    const runtime = new GameRuntime('test_slot', testMap, 400, 300, {
      play: (event) => played.push(event.type),
    });

    runtime.damagePlayer(5);
    expect(played).toContain('PLAYER_DAMAGED');
    // The event is still queued for domain consumers.
    expect(runtime.currentSession.eventQueue.some((e) => e.type === 'PLAYER_DAMAGED')).toBe(true);

    runtime.respawnPlayer();
    expect(played).toContain('PLAYER_RESPAWNED');

    runtime.dispose();
  });
});
