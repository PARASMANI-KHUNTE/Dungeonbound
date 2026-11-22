import { Vector2, createVector2 } from '../domain/value-objects/Vector2';

export interface ViewportRect {
  readonly minCol: number;
  readonly maxCol: number;
  readonly minRow: number;
  readonly maxRow: number;
}

export interface CameraConfig {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
}

export class Camera {
  private _position: Vector2;
  private _viewportWidth: number;
  private _viewportHeight: number;
  private _worldWidth: number;
  private _worldHeight: number;

  constructor(config: CameraConfig, initialPosition: Vector2 = createVector2(0, 0)) {
    this._viewportWidth = config.viewportWidth;
    this._viewportHeight = config.viewportHeight;
    this._worldWidth = config.worldWidth;
    this._worldHeight = config.worldHeight;
    this._position = this.clampPosition(initialPosition);
  }

  get position(): Vector2 {
    return this._position;
  }

  get viewportWidth(): number {
    return this._viewportWidth;
  }

  get viewportHeight(): number {
    return this._viewportHeight;
  }

  setDimensions(viewportWidth: number, viewportHeight: number): void {
    this._viewportWidth = viewportWidth;
    this._viewportHeight = viewportHeight;
    this._position = this.clampPosition(this._position);
  }

  /**
   * Focuses camera directly on a target position (e.g. player position),
   * clamping to world bounds so camera doesn't show void outside map.
   */
  followTarget(targetPosition: Vector2): void {
    this._position = this.clampPosition(targetPosition);
  }

  /**
   * Converts world coordinates (x, y) to viewport screen coordinates.
   */
  worldToScreen(worldPoint: Vector2): Vector2 {
    return createVector2(
      worldPoint.x - (this._position.x - this._viewportWidth / 2),
      worldPoint.y - (this._position.y - this._viewportHeight / 2)
    );
  }

  /**
   * Converts viewport screen coordinates to world coordinates.
   */
  screenToWorld(screenPoint: Vector2): Vector2 {
    return createVector2(
      screenPoint.x + (this._position.x - this._viewportWidth / 2),
      screenPoint.y + (this._position.y - this._viewportHeight / 2)
    );
  }

  /**
   * Calculates visible tile index ranges (culling bounds) for rendering.
   * Adds extra padding tile margin to prevent tile pop-in at borders.
   */
  getVisibleTileRange(tileSize: number, marginTiles = 1): ViewportRect {
    const halfW = this._viewportWidth / 2;
    const halfH = this._viewportHeight / 2;

    const left = this._position.x - halfW;
    const right = this._position.x + halfW;
    const top = this._position.y - halfH;
    const bottom = this._position.y + halfH;

    const minCol = Math.max(0, Math.floor(left / tileSize) - marginTiles);
    const maxCol = Math.floor(right / tileSize) + marginTiles;
    const minRow = Math.max(0, Math.floor(top / tileSize) - marginTiles);
    const maxRow = Math.floor(bottom / tileSize) + marginTiles;

    return { minCol, maxCol, minRow, maxRow };
  }

  private clampPosition(pos: Vector2): Vector2 {
    const halfW = this._viewportWidth / 2;
    const halfH = this._viewportHeight / 2;

    // If world is smaller than viewport, center on world
    const x =
      this._worldWidth <= this._viewportWidth
        ? this._worldWidth / 2
        : Math.max(halfW, Math.min(this._worldWidth - halfW, pos.x));

    const y =
      this._worldHeight <= this._viewportHeight
        ? this._worldHeight / 2
        : Math.max(halfH, Math.min(this._worldHeight - halfH, pos.y));

    return createVector2(x, y);
  }
}
