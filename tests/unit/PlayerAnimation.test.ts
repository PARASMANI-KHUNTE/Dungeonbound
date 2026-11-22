import { GameRuntime } from '@/game/engine/GameRuntime';
import { parseTileMap } from '@/game/world/TileMapParser';

describe('PlayerAnimation', () => {
  const testMap = parseTileMap({
    id: 'anim_test_map',
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

  it('starts in idle state with frame 0', () => {
    const runtime = new GameRuntime('anim_slot', testMap, 400, 300);
    const proj = runtime.createProjection();

    expect(proj.player.animation.state).toBe('idle');
    expect(proj.player.animation.frame).toBe(0);

    runtime.dispose();
  });

  it('transitions to walk state and cycles walk frames 0..3 during movement', () => {
    const runtime = new GameRuntime('anim_slot', testMap, 400, 300);
    runtime.start(() => 0);

    // Command continuous right movement
    runtime.input.setMovement(1, 0);

    // Step 1: initial movement sets walk state
    runtime.fixedUpdate(1 / 60);
    expect(runtime.createProjection().player.animation.state).toBe('walk');

    // Simulate 480ms of continuous walking (4 frames * 120ms)
    // Frame 0: 0..120ms
    // Frame 1: 120..240ms
    // Frame 2: 240..360ms
    // Frame 3: 360..480ms
    const framesObserved = new Set<number>();

    for (let i = 0; i < 30; i++) {
      runtime.fixedUpdate(1 / 60);
      framesObserved.add(runtime.createProjection().player.animation.frame);
    }

    // Must have cycled through multiple walk frames
    expect(framesObserved.size).toBeGreaterThanOrEqual(2);

    // Releasing input returns to idle
    runtime.input.setMovement(0, 0);
    runtime.fixedUpdate(1 / 60);
    expect(runtime.createProjection().player.animation.state).toBe('idle');

    runtime.dispose();
  });

  it('enters attack animation state during attack and dead state on death', () => {
    const runtime = new GameRuntime('anim_slot', testMap, 400, 300);
    runtime.start(() => 0);

    runtime.triggerPlayerAttack();
    expect(runtime.createProjection().player.animation.state).toBe('attack');

    // Kill player
    runtime.damagePlayer(100);
    expect(runtime.createProjection().player.animation.state).toBe('dead');

    runtime.dispose();
  });
});
