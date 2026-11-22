import { MapDefinition } from './MapDefinition';
import { Vector2, createVector2 } from '../domain/value-objects/Vector2';

export interface CollisionBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

// Solid tile IDs: 4 (Water), 7 (Border Stone / Fence)
export const DEFAULT_SOLID_TILES = new Set<number>([4, 7]);

export class CollisionGrid {
  private solidTiles: boolean[][];
  private widthInTiles: number;
  private heightInTiles: number;
  private tileSize: number;

  constructor(map: MapDefinition, solidTileIds = DEFAULT_SOLID_TILES) {
    this.widthInTiles = map.widthInTiles;
    this.heightInTiles = map.heightInTiles;
    this.tileSize = map.tileSize;

    this.solidTiles = Array.from({ length: this.heightInTiles }, () =>
      new Array(this.widthInTiles).fill(false)
    );

    for (const layer of map.layers) {
      for (let r = 0; r < this.heightInTiles; r++) {
        for (let c = 0; c < this.widthInTiles; c++) {
          const tileId = layer.data[r * this.widthInTiles + c];
          if (solidTileIds.has(tileId)) {
            this.solidTiles[r][c] = true;
          }
        }
      }
    }
  }

  isSolid(col: number, row: number): boolean {
    if (col < 0 || col >= this.widthInTiles || row < 0 || row >= this.heightInTiles) {
      return true; // Out of bounds is solid
    }
    return this.solidTiles[row][col];
  }

  /**
   * Tests whether an AABB foot box collides with solid tiles.
   */
  isBoxColliding(centerX: number, centerY: number, halfWidth: number, halfHeight: number): boolean {
    const leftCol = Math.floor((centerX - halfWidth) / this.tileSize);
    const rightCol = Math.floor((centerX + halfWidth) / this.tileSize);
    const topRow = Math.floor((centerY - halfHeight) / this.tileSize);
    const bottomRow = Math.floor((centerY + halfHeight) / this.tileSize);

    for (let r = topRow; r <= bottomRow; r++) {
      for (let c = leftCol; c <= rightCol; c++) {
        if (this.isSolid(c, r)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Resolves intended position against solid tiles with wall-sliding:
   * Tests X movement and Y movement independently.
   */
  resolveMovement(
    currentPos: Vector2,
    displacement: Vector2,
    halfWidth = 10,
    halfHeight = 10
  ): Vector2 {
    let newX = currentPos.x;
    let newY = currentPos.y;

    // Test X axis movement
    const targetX = currentPos.x + displacement.x;
    if (!this.isBoxColliding(targetX, currentPos.y, halfWidth, halfHeight)) {
      newX = targetX;
    }

    // Test Y axis movement
    const targetY = currentPos.y + displacement.y;
    if (!this.isBoxColliding(newX, targetY, halfWidth, halfHeight)) {
      newY = targetY;
    }

    return createVector2(newX, newY);
  }
}
