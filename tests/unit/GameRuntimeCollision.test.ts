import { VILLAGE_OUTSKIRTS_MAP } from '@/game/content/definitions/maps';
import { GameRuntime } from '@/game/engine/GameRuntime';

describe('GameRuntimeCollision (Runtime Integration)', () => {
  it('prevents player from passing outside map bounds (world borders) through fixedUpdate', () => {
    const runtime = new GameRuntime('collision_test_slot', VILLAGE_OUTSKIRTS_MAP, 800, 450);
    runtime.start(() => 0);

    // Place player near the western edge (x = 25, y = 300)
    runtime.setPlayerPositionAndFacing({ x: 25, y: 300 }, 'left');

    // Drive player hard to the west (dx = -1) across 60 fixed update steps (1 second)
    runtime.input.setMovement(-1, 0);
    for (let i = 0; i < 60; i++) {
      runtime.fixedUpdate(1 / 60);
    }

    const westPos = runtime.currentSession.player.transform.position;
    // With 10px player bounding box half-extents, player cannot exceed western border (x < 10)
    expect(westPos.x).toBeGreaterThanOrEqual(10);
    expect(westPos.y).toBe(300);

    // Drive player hard north towards y = 0
    runtime.input.setMovement(0, -1);
    for (let i = 0; i < 120; i++) {
      runtime.fixedUpdate(1 / 60);
    }
    const northPos = runtime.currentSession.player.transform.position;
    expect(northPos.y).toBeGreaterThanOrEqual(10);

    // Drive player towards world eastern boundary (worldWidth = 30 * 32 = 960)
    runtime.input.setMovement(1, 0);
    for (let i = 0; i < 600; i++) {
      runtime.fixedUpdate(1 / 60);
    }
    const eastPos = runtime.currentSession.player.transform.position;
    expect(eastPos.x).toBeLessThanOrEqual(960 - 10);

    // Drive player towards world southern boundary (worldHeight = 20 * 32 = 640)
    runtime.input.setMovement(0, 1);
    for (let i = 0; i < 600; i++) {
      runtime.fixedUpdate(1 / 60);
    }
    const southPos = runtime.currentSession.player.transform.position;
    expect(southPos.y).toBeLessThanOrEqual(640 - 10);

    runtime.dispose();
  });

  it('prevents player from walking into solid obstacle tiles on village_outskirts', () => {
    const runtime = new GameRuntime('collision_test_slot', VILLAGE_OUTSKIRTS_MAP, 800, 450);
    runtime.start(() => 0);

    // Find a solid tile in the collision grid of VILLAGE_OUTSKIRTS_MAP
    // Tile ID 7 (wall stone) or 4 (water) are solid
    const grid = runtime.currentSession.collisionGrid;
    let solidCol = -1;
    let solidRow = -1;

    for (let r = 1; r < VILLAGE_OUTSKIRTS_MAP.heightInTiles - 1; r++) {
      for (let c = 1; c < VILLAGE_OUTSKIRTS_MAP.widthInTiles - 1; c++) {
        if (grid.isSolid(c, r)) {
          solidCol = c;
          solidRow = r;
          break;
        }
      }
      if (solidCol !== -1) break;
    }

    expect(solidCol).toBeGreaterThan(0);
    expect(solidRow).toBeGreaterThan(0);

    // Solid tile center and bounding rect
    const tileSize = VILLAGE_OUTSKIRTS_MAP.tileSize;
    const solidTileLeft = solidCol * tileSize;
    const solidTileTop = solidRow * tileSize;

    // Place player just to the left of the solid tile
    // Half-extents are 10, so player center at solidTileLeft - 15 means right edge at solidTileLeft - 5
    const startX = solidTileLeft - 15;
    const startY = solidTileTop + tileSize / 2;
    runtime.setPlayerPositionAndFacing({ x: startX, y: startY }, 'right');

    // Drive player right (into the solid tile)
    runtime.input.setMovement(1, 0);
    for (let i = 0; i < 30; i++) {
      runtime.fixedUpdate(1 / 60);
    }

    const blockedPos = runtime.currentSession.player.transform.position;
    // Player's right edge (blockedPos.x + 10) must NOT penetrate solidTileLeft
    expect(blockedPos.x + 10).toBeLessThanOrEqual(solidTileLeft + 0.001);

    runtime.dispose();
  });

  it('supports wall sliding: moving diagonally into a solid wall allows perpendicular movement', () => {
    const runtime = new GameRuntime('collision_test_slot', VILLAGE_OUTSKIRTS_MAP, 800, 450);
    runtime.start(() => 0);

    const grid = runtime.currentSession.collisionGrid;
    const tileSize = VILLAGE_OUTSKIRTS_MAP.tileSize;

    // Find a solid tile that has open space below it
    let targetCol = -1;
    let targetRow = -1;

    for (let r = 1; r < VILLAGE_OUTSKIRTS_MAP.heightInTiles - 2; r++) {
      for (let c = 1; c < VILLAGE_OUTSKIRTS_MAP.widthInTiles - 1; c++) {
        if (grid.isSolid(c, r) && !grid.isSolid(c - 1, r) && !grid.isSolid(c - 1, r + 1)) {
          targetCol = c;
          targetRow = r;
          break;
        }
      }
      if (targetCol !== -1) break;
    }

    if (targetCol !== -1) {
      const solidTileLeft = targetCol * tileSize;
      const startX = solidTileLeft - 11;
      const startY = targetRow * tileSize + 10;
      runtime.setPlayerPositionAndFacing({ x: startX, y: startY }, 'down');

      // Move diagonally down-right (dx = 1, dy = 1)
      runtime.input.setMovement(1, 1);
      for (let i = 0; i < 20; i++) {
        runtime.fixedUpdate(1 / 60);
      }

      const endPos = runtime.currentSession.player.transform.position;
      // X should remain blocked at the wall face
      expect(endPos.x + 10).toBeLessThanOrEqual(solidTileLeft + 0.001);
      // Y should have slid downwards
      expect(endPos.y).toBeGreaterThan(startY);
    }

    runtime.dispose();
  });
});
