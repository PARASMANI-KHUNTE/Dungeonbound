import { Vector2, createVector2 } from '../game/domain/value-objects/Vector2';
import { ViewportRect } from '../game/world/Camera';

export interface CameraTransformState {
  readonly position: Vector2;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

export function worldToScreenPosition(
  worldPoint: Vector2,
  camera: CameraTransformState
): Vector2 {
  const cameraLeft = camera.position.x - camera.viewportWidth / 2;
  const cameraTop = camera.position.y - camera.viewportHeight / 2;
  return createVector2(worldPoint.x - cameraLeft, worldPoint.y - cameraTop);
}

export function screenToWorldPosition(
  screenPoint: Vector2,
  camera: CameraTransformState
): Vector2 {
  const cameraLeft = camera.position.x - camera.viewportWidth / 2;
  const cameraTop = camera.position.y - camera.viewportHeight / 2;
  return createVector2(screenPoint.x + cameraLeft, screenPoint.y + cameraTop);
}

export function calculateVisibleTileBounds(
  camera: CameraTransformState,
  tileSize: number,
  maxCols: number,
  maxRows: number,
  margin = 1
): ViewportRect {
  const left = camera.position.x - camera.viewportWidth / 2;
  const right = camera.position.x + camera.viewportWidth / 2;
  const top = camera.position.y - camera.viewportHeight / 2;
  const bottom = camera.position.y + camera.viewportHeight / 2;

  const minCol = Math.max(0, Math.floor(left / tileSize) - margin);
  const maxCol = Math.min(maxCols - 1, Math.floor(right / tileSize) + margin);
  const minRow = Math.max(0, Math.floor(top / tileSize) - margin);
  const maxRow = Math.min(maxRows - 1, Math.floor(bottom / tileSize) + margin);

  return { minCol, maxCol, minRow, maxRow };
}
