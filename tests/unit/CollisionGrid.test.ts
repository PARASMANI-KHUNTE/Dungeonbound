import { CollisionGrid } from '@/game/world/CollisionGrid';
import { parseTileMap } from '@/game/world/TileMapParser';
import { createVector2 } from '@/game/domain/value-objects/Vector2';

describe('CollisionGrid', () => {
  const testMap = parseTileMap({
    width: 5,
    height: 5,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        name: 'Ground',
        data: [
          7, 7, 7, 7, 7, // Row 0: Solid border stones (tile 7)
          7, 1, 1, 1, 7, // Row 1: Grass
          7, 1, 4, 1, 7, // Row 2: Water at (2, 2) (tile 4)
          7, 1, 1, 1, 7, // Row 3: Grass
          7, 7, 7, 7, 7, // Row 4: Solid border stones
        ],
      },
    ],
  });

  it('identifies solid tiles correctly', () => {
    const grid = new CollisionGrid(testMap);
    // (0, 0) is border stone (solid)
    expect(grid.isSolid(0, 0)).toBe(true);
    // (1, 1) is grass (walkable)
    expect(grid.isSolid(1, 1)).toBe(false);
    // (2, 2) is water (solid)
    expect(grid.isSolid(2, 2)).toBe(true);
  });

  it('allows sliding along solid walls when moving diagonally into a wall', () => {
    const grid = new CollisionGrid(testMap);
    // Position at (48, 48) (col 1, row 1 - grass)
    const current = createVector2(48, 48);

    // Attempt to move up-right: Up (y - 30) is blocked by Row 0 border, Right (x + 10) is free
    const resolved = grid.resolveMovement(current, createVector2(10, -30), 10, 10);
    // X axis advanced
    expect(resolved.x).toBe(58);
    // Y axis was blocked by wall and did not move into tile row 0
    expect(resolved.y).toBe(48);
  });
});
