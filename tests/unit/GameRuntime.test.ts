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
});
