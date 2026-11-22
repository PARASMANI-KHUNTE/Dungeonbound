import {
  PaintStyle,
  Skia,
  type SkCanvas,
  type SkPaint,
  type SkPicture,
  type SkPictureRecorder,
} from '@shopify/react-native-skia';
import { RenderProjection } from '@/game/application/GameProjection';
import { calculateVisibleTileBounds, worldToScreenPosition } from './CameraRenderer';

export const TILE_COLORS: Record<number, string> = {
  1: '#2A5528', // Grass
  2: '#7F5539', // Dirt road
  3: '#4A4E69', // Cobblestone plaza
  4: '#1D3557', // Water (solid)
  5: '#E63946', // Flower patch
  6: '#1E3F20', // Bush
  7: '#524B4B', // Wall / border stone (solid)
};

export interface DrawingResources {
  readonly recorder: SkPictureRecorder;
  readonly fillPaint: SkPaint;
  readonly strokePaint: SkPaint;
}

export function createDrawingResources(): DrawingResources {
  const fillPaint = Skia.Paint();
  const strokePaint = Skia.Paint();
  fillPaint.setAntiAlias(true);
  strokePaint.setAntiAlias(true);
  strokePaint.setStyle(PaintStyle.Stroke);
  return {
    recorder: Skia.PictureRecorder(),
    fillPaint,
    strokePaint,
  };
}

export function createEmptyPicture(width: number, height: number): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording({ x: 0, y: 0, width, height });
  canvas.clear(Skia.Color('#0F171E'));
  return recorder.finishRecordingAsPicture();
}

function setFill(paint: SkPaint, color: string, alpha = 1): void {
  paint.setStyle(PaintStyle.Fill);
  paint.setColor(Skia.Color(color));
  paint.setAlphaf(alpha);
}

function setStroke(paint: SkPaint, color: string, strokeWidth: number): void {
  paint.setStyle(PaintStyle.Stroke);
  paint.setColor(Skia.Color(color));
  paint.setAlphaf(1);
  paint.setStrokeWidth(strokeWidth);
}

function pickUpColor(itemId: string): string {
  if (itemId.includes('potion')) return '#E63946';
  if (itemId.includes('sword') || itemId.includes('rapier')) return '#48CAE4';
  if (itemId.includes('ring') || itemId.includes('talisman')) return '#FFD166';
  if (
    itemId.includes('tunic') ||
    itemId.includes('chainmail') ||
    itemId.includes('helmet') ||
    itemId.includes('cap')
  ) {
    return '#90BE6D';
  }
  return '#FAF0CA';
}

function isOnScreen(x: number, y: number, width: number, height: number, margin: number): boolean {
  return x >= -margin && x <= width + margin && y >= -margin && y <= height + margin;
}

/**
 * Draws a complete frame directly onto a Skia canvas.
 *
 * This is deliberately imperative: no React state is updated while the game
 * runs, so gameplay rendering never causes a React re-render per frame.
 */
export function drawGameFrame(
  canvas: SkCanvas,
  projection: RenderProjection,
  resources: DrawingResources,
  width: number,
  height: number
): void {
  const { player, enemies, pickups, camera, map } = projection;
  const { fillPaint, strokePaint } = resources;

  canvas.clear(Skia.Color('#0F171E'));

  const cameraState = {
    position: camera.position,
    viewportWidth: width,
    viewportHeight: height,
  };
  const cameraLeft = camera.position.x - width / 2;
  const cameraTop = camera.position.y - height / 2;
  const tileSize = map.tileSize;
  const visibleBounds = calculateVisibleTileBounds(
    cameraState,
    tileSize,
    map.widthInTiles,
    map.heightInTiles,
    1
  );

  // Ground / decoration layers, viewport-culled.
  for (const layer of map.layers) {
    if (!layer.visible) continue;
    for (let row = visibleBounds.minRow; row <= visibleBounds.maxRow; row++) {
      for (let col = visibleBounds.minCol; col <= visibleBounds.maxCol; col++) {
        const tileId = layer.data[row * map.widthInTiles + col];
        if (!tileId) continue;
        setFill(fillPaint, TILE_COLORS[tileId] ?? '#333333');
        canvas.drawRect(
          {
            x: col * tileSize - cameraLeft,
            y: row * tileSize - cameraTop,
            width: tileSize,
            height: tileSize,
          },
          fillPaint
        );
      }
    }
  }

  // Ground pickups.
  for (const pickup of pickups) {
    const pos = worldToScreenPosition(pickup.position, cameraState);
    if (!isOnScreen(pos.x, pos.y, width, height, 20)) continue;
    setFill(fillPaint, '#000000', 0.4);
    canvas.drawCircle(pos.x, pos.y + 4, 6, fillPaint);
    setFill(fillPaint, '#FFFFFF', 0.3);
    canvas.drawCircle(pos.x, pos.y, 7, fillPaint);
    setFill(fillPaint, pickUpColor(pickup.itemId));
    canvas.drawCircle(pos.x, pos.y, 4.5, fillPaint);
  }

  // Enemies.
  for (const enemy of enemies) {
    const pos = worldToScreenPosition(enemy.position, cameraState);
    if (!isOnScreen(pos.x, pos.y, width, height, 32)) continue;

    if (enemy.state === 'dead') {
      setFill(fillPaint, '#33272A');
      canvas.drawCircle(pos.x, pos.y, 10, fillPaint);
      setFill(fillPaint, '#1E1618');
      canvas.drawCircle(pos.x, pos.y, 5, fillPaint);
      continue;
    }

    const bodyColor =
      enemy.state === 'hurt' ? '#E63946' : enemy.state === 'attack' ? '#D90429' : '#2D6A4F';

    setFill(fillPaint, '#000000', 0.4);
    canvas.drawCircle(pos.x, pos.y + 9, 11, fillPaint);
    setFill(fillPaint, bodyColor);
    canvas.drawCircle(pos.x, pos.y, 11, fillPaint);
    setFill(fillPaint, '#D8F3DC');
    canvas.drawCircle(pos.x, pos.y, 5, fillPaint);

    const hpRatio = Math.max(0, Math.min(1, enemy.currentHealth / enemy.maxHealth));
    setFill(fillPaint, '#1A1829');
    canvas.drawRect({ x: pos.x - 12, y: pos.y - 18, width: 24, height: 3 }, fillPaint);
    setFill(fillPaint, hpRatio > 0.4 ? '#52B788' : '#E63946');
    canvas.drawRect({ x: pos.x - 12, y: pos.y - 18, width: 24 * hpRatio, height: 3 }, fillPaint);
  }

  // Player.
  const playerPos = worldToScreenPosition(player.position, cameraState);
  const walkBob = player.animation.state === 'walk' && player.animation.frame % 2 === 1 ? -2 : 0;

  if (player.isDead) {
    setFill(fillPaint, '#555B6E');
    canvas.drawRect({ x: playerPos.x - 8, y: playerPos.y - 12, width: 16, height: 22 }, fillPaint);
    canvas.drawCircle(playerPos.x, playerPos.y - 12, 8, fillPaint);
  } else {
    setFill(fillPaint, '#000000', 0.45);
    canvas.drawCircle(playerPos.x, playerPos.y + 11, 13, fillPaint);
    setFill(fillPaint, player.isInvulnerable ? '#E63946' : '#E5A93C');
    canvas.drawCircle(playerPos.x, playerPos.y + walkBob, 13, fillPaint);
    setFill(fillPaint, '#FAF0CA');
    canvas.drawCircle(playerPos.x, playerPos.y + walkBob, 7, fillPaint);

    const facingRadius = 11;
    const facingOffset =
      player.facing === 'up'
        ? { x: 0, y: -facingRadius }
        : player.facing === 'down'
          ? { x: 0, y: facingRadius }
          : player.facing === 'left'
            ? { x: -facingRadius, y: 0 }
            : { x: facingRadius, y: 0 };
    setFill(fillPaint, '#9E2A2B');
    canvas.drawCircle(
      playerPos.x + facingOffset.x,
      playerPos.y + facingOffset.y + walkBob,
      3.5,
      fillPaint
    );

    if (player.isAttacking) {
      const distance = 26;
      const slash =
        player.facing === 'up'
          ? { x1: playerPos.x - 18, y1: playerPos.y - distance, x2: playerPos.x + 18, y2: playerPos.y - distance }
          : player.facing === 'down'
            ? { x1: playerPos.x - 18, y1: playerPos.y + distance, x2: playerPos.x + 18, y2: playerPos.y + distance }
            : player.facing === 'left'
              ? { x1: playerPos.x - distance, y1: playerPos.y - 18, x2: playerPos.x - distance, y2: playerPos.y + 18 }
              : { x1: playerPos.x + distance, y1: playerPos.y - 18, x2: playerPos.x + distance, y2: playerPos.y + 18 };
      setStroke(strokePaint, '#FAF0CA', 4);
      canvas.drawLine(slash.x1, slash.y1, slash.x2, slash.y2, strokePaint);
    }
  }
}
