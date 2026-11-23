import { GameRuntime } from '@/game/engine/GameRuntime';
import { parseTileMap } from '@/game/world/TileMapParser';

describe('DecoupledRender (No Per-Frame React Re-renders)', () => {
  const testMap = parseTileMap({
    id: 'decoupled_test_map',
    width: 20,
    height: 20,
    tilewidth: 32,
    tileheight: 32,
    spawnPoint: { x: 320, y: 320 },
    layers: [
      {
        name: 'Ground',
        data: new Array(400).fill(1),
      },
    ],
  });

  it('throttles UI notifications so 60 fixed update steps do NOT trigger 60 UI re-renders', () => {
    const runtime = new GameRuntime('ui_test_slot', testMap, 400, 300);
    runtime.start(() => 0);

    let uiNotificationCount = 0;
    // Subscribe to UI notifications with 100ms throttle (10 Hz)
    runtime.subscribeUI(() => {
      uiNotificationCount++;
    }, 100);

    // Initial notification
    expect(uiNotificationCount).toBe(1);

    // Move player continuously across 60 fixed steps (1 full second = 60 frames)
    runtime.input.setMovement(1, 0);
    for (let i = 0; i < 60; i++) {
      runtime.fixedUpdate(1 / 60);
    }

    // During 1.0s of continuous 60 FPS movement:
    // With 100ms throttling, UI should be notified at most ~10-11 times, NOT 60 times!
    expect(uiNotificationCount).toBeLessThanOrEqual(12);
    expect(uiNotificationCount).toBeGreaterThan(0);

    runtime.dispose();
  });

  it('triggers immediate UI notification on critical discrete events', () => {
    const runtime = new GameRuntime('ui_test_slot', testMap, 400, 300);
    runtime.start(() => 0);

    let uiNotificationCount = 0;
    runtime.subscribeUI(() => {
      uiNotificationCount++;
    }, 100);

    const prevCount = uiNotificationCount;

    // Pausing game must notify UI immediately
    runtime.pause();
    expect(uiNotificationCount).toBe(prevCount + 1);

    // Resuming game must notify UI immediately
    runtime.resume();
    expect(uiNotificationCount).toBe(prevCount + 2);

    // Damaging player must notify UI immediately
    runtime.damagePlayer(20);
    expect(uiNotificationCount).toBe(prevCount + 3);

    runtime.dispose();
  });

  it('proves GameCanvas render path uses imperative ref subscription and zero per-frame React useState', () => {
    // Read the source of GameCanvas to assert architectural invariant:
    // It must NOT contain useState for render projections
    const fs = require('fs');
    const path = require('path');
    const gameCanvasSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/rendering/GameCanvas.tsx'),
      'utf8'
    );

    // Must not use useState for frame projection updates
    expect(gameCanvasSource).not.toMatch(/useState<RenderProjection>/);
    expect(gameCanvasSource).not.toMatch(/setProjection\(/);

    // Must use ref-based projection and useCanvasRef for decoupled drawing
    expect(gameCanvasSource).toMatch(/useCanvasRef\(\)/);
    expect(gameCanvasSource).toMatch(/projectionRef\.current/);
    expect(gameCanvasSource).toMatch(/canvasRef\.current\?\.redraw\(\)/);
  });
});
