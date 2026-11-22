import { Camera } from '@/game/world/Camera';
import { createVector2 } from '@/game/domain/value-objects/Vector2';

describe('Camera', () => {
  const config = {
    viewportWidth: 400,
    viewportHeight: 300,
    worldWidth: 960,
    worldHeight: 640,
  };

  it('initializes position clamped within world bounds', () => {
    // If target is (0, 0), camera should clamp to (halfW, halfH) = (200, 150)
    const camera = new Camera(config, createVector2(0, 0));
    expect(camera.position.x).toBe(200);
    expect(camera.position.y).toBe(150);
  });

  it('follows target and clamps at max world edges', () => {
    const camera = new Camera(config, createVector2(500, 400));
    // Center target inside valid range
    camera.followTarget(createVector2(500, 350));
    expect(camera.position.x).toBe(500);
    expect(camera.position.y).toBe(350);

    // Target far beyond bottom-right corner (1200, 900)
    // Max x = worldWidth - halfW = 960 - 200 = 760
    // Max y = worldHeight - halfH = 640 - 150 = 490
    camera.followTarget(createVector2(1200, 900));
    expect(camera.position.x).toBe(760);
    expect(camera.position.y).toBe(490);
  });

  it('converts world coordinates to screen coordinates and vice versa', () => {
    const camera = new Camera(config, createVector2(480, 320));
    // Point at camera center should be at screen center (200, 150)
    const centerScreen = camera.worldToScreen(createVector2(480, 320));
    expect(centerScreen.x).toBe(200);
    expect(centerScreen.y).toBe(150);

    // Reversible conversion
    const backToWorld = camera.screenToWorld(centerScreen);
    expect(backToWorld.x).toBe(480);
    expect(backToWorld.y).toBe(320);
  });

  it('computes visible tile ranges with culling padding', () => {
    const camera = new Camera(config, createVector2(480, 320));
    const tileSize = 32;
    const range = camera.getVisibleTileRange(tileSize, 1);

    // Left = 480 - 200 = 280, col = floor(280/32) = 8, minCol with margin 1 = 7
    // Right = 480 + 200 = 680, col = floor(680/32) = 21, maxCol with margin 1 = 22
    expect(range.minCol).toBe(7);
    expect(range.maxCol).toBe(22);
    expect(range.minRow).toBe(4);
    expect(range.maxRow).toBe(15);
  });
});
