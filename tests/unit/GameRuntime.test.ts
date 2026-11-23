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

  it('resets touch input adapter to neutral on pause (app interruption)', () => {
    const runtime = new GameRuntime('test_slot', testMap, 400, 300);
    runtime.start(() => 0);

    // Simulate active player movement and attack input before interruption
    runtime.input.setMovement(0.8, -0.6);
    runtime.input.setAttacking(true);

    const activeSnapshot = runtime.input.readSnapshot();
    expect(activeSnapshot.moveVector.x).toBeCloseTo(0.8);
    expect(activeSnapshot.moveVector.y).toBeCloseTo(-0.6);
    expect(activeSnapshot.isAttacking).toBe(true);

    // Interruption / pause occurs
    runtime.pause();

    // Input must return to neutral
    const neutralSnapshot = runtime.input.readSnapshot();
    expect(neutralSnapshot.moveVector.x).toBe(0);
    expect(neutralSnapshot.moveVector.y).toBe(0);
    expect(neutralSnapshot.isAttacking).toBe(false);

    // Resuming does not retain stale input vector
    runtime.resume();
    const resumeSnapshot = runtime.input.readSnapshot();
    expect(resumeSnapshot.moveVector.x).toBe(0);
    expect(resumeSnapshot.moveVector.y).toBe(0);
    expect(resumeSnapshot.isAttacking).toBe(false);

    runtime.dispose();
  });
});
