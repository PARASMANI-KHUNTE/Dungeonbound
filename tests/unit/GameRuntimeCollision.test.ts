import { GameRuntime } from '@/game/engine/GameRuntime';
import { parseTileMap } from '@/game/world/TileMapParser';

describe('GameRuntime collision integration', () => {
  const testMap = parseTileMap({
    id: 'collision_runtime_map',
    width: 5,
    height: 5,
    tilewidth: 32,
    tileheight: 32,
    spawnPoint: { x: 48, y: 80 },
    layers: [
      {
        name: 'Ground',
        data: [
          7, 7, 7, 7, 7,
          7, 1, 1, 1, 7,
          7, 1, 4, 1, 7,
          7, 1, 1, 1, 7,
          7, 7, 7, 7, 7,
        ],
      },
    ],
  });

  function createRuntime(): GameRuntime {
    const runtime = new GameRuntime('slot_1', testMap, 160, 160);
    // Remove scripted enemies so the assertions only cover player collision.
    runtime.currentSession.enemies.clear();
    return runtime;
  }

  function simulate(runtime: GameRuntime, steps: number): void {
    for (let i = 0; i < steps; i++) {
      runtime.fixedUpdate(1 / 60);
    }
  }

  it('blocks the player from walking through a solid water tile', () => {
    const runtime = createRuntime();
    runtime.setPlayerPositionAndFacing({ x: 48, y: 80 }, 'right');
    runtime.input.setMovement(1, 0);

    simulate(runtime, 120);

    const position = runtime.createProjection().player.position;
    // Water starts at x=64; a 10px half-width box cannot reach it.
    expect(position.x).toBeLessThan(64);
    expect(position.y).toBeCloseTo(80, 5);
    runtime.dispose();
  });

  it('blocks the player from leaving the map through the solid border', () => {
    const runtime = createRuntime();
    runtime.setPlayerPositionAndFacing({ x: 48, y: 48 }, 'up');
    runtime.input.setMovement(0, -1);

    simulate(runtime, 120);

    const position = runtime.createProjection().player.position;
    // Row 0 is solid from y=0..32; a 10px half-height box stops at y=42.
    expect(position.y).toBeGreaterThanOrEqual(42);
    expect(position.x).toBeCloseTo(48, 5);
    runtime.dispose();
  });
});
