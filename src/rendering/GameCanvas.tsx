import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';
import { RenderProjection } from '@/game/application/GameProjection';
import { calculateVisibleTileBounds, worldToScreenPosition } from './CameraRenderer';

export interface GameCanvasProps {
  readonly projection: RenderProjection;
  readonly width: number;
  readonly height: number;
}

// Color palette for data-driven tile types
const TILE_COLORS: Record<number, string> = {
  1: '#2A5528', // Grass
  2: '#7F5539', // Dirt road
  3: '#4A4E69', // Cobblestone plaza
  4: '#1D3557', // Water
  5: '#E63946', // Flower patch
  6: '#1E3F20', // Bush
  7: '#524B4B', // Wall / border stone
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  projection,
  width,
  height,
}) => {
  const { player, camera, map } = projection;
  const tileSize = map.tileSize;

  const cameraState = useMemo(
    () => ({
      position: camera.position,
      viewportWidth: width,
      viewportHeight: height,
    }),
    [camera.position, width, height]
  );

  // Viewport culling: only calculate visible tile slice
  const visibleBounds = useMemo(() => {
    return calculateVisibleTileBounds(
      cameraState,
      tileSize,
      map.widthInTiles,
      map.heightInTiles,
      1
    );
  }, [cameraState, tileSize, map.widthInTiles, map.heightInTiles]);

  // Compute screen position of player
  const playerScreenPos = useMemo(() => {
    return worldToScreenPosition(player.position, cameraState);
  }, [player.position, cameraState]);

  // Facing indicator offset
  const facingOffset = useMemo(() => {
    const radius = 10;
    switch (player.facing) {
      case 'up':
        return { x: 0, y: -radius };
      case 'down':
        return { x: 0, y: radius };
      case 'left':
        return { x: -radius, y: 0 };
      case 'right':
        return { x: radius, y: 0 };
    }
  }, [player.facing]);

  // Generate visible tiles to render
  const visibleTiles = useMemo(() => {
    const result: Array<{
      key: string;
      x: number;
      y: number;
      color: string;
      size: number;
    }> = [];

    const cameraLeft = cameraState.position.x - width / 2;
    const cameraTop = cameraState.position.y - height / 2;

    for (const layer of map.layers) {
      if (!layer.visible) continue;

      for (let r = visibleBounds.minRow; r <= visibleBounds.maxRow; r++) {
        for (let c = visibleBounds.minCol; c <= visibleBounds.maxCol; c++) {
          const tileIndex = r * map.widthInTiles + c;
          const tileId = layer.data[tileIndex];
          if (!tileId || tileId === 0) continue;

          const color = TILE_COLORS[tileId] ?? '#333333';
          const screenX = c * tileSize - cameraLeft;
          const screenY = r * tileSize - cameraTop;

          result.push({
            key: `${layer.id}_${r}_${c}`,
            x: screenX,
            y: screenY,
            color,
            size: tileSize,
          });
        }
      }
    }
    return result;
  }, [map, visibleBounds, cameraState, width, height, tileSize]);

  return (
    <View style={[styles.container, { width, height }]}>
      <Canvas style={{ width, height }}>
        {/* Render visible map tiles */}
        {visibleTiles.map((tile) => (
          <Rect
            key={tile.key}
            x={tile.x}
            y={tile.y}
            width={tile.size}
            height={tile.size}
            color={tile.color}
          />
        ))}

        {/* Render player character */}
        <Group>
          {/* Shadow */}
          <Circle
            cx={playerScreenPos.x}
            cy={playerScreenPos.y + 11}
            r={13}
            color="rgba(0, 0, 0, 0.45)"
          />
          {/* Hero body */}
          <Circle
            cx={playerScreenPos.x}
            cy={playerScreenPos.y}
            r={13}
            color="#E5A93C"
          />
          {/* Hero emblem */}
          <Circle
            cx={playerScreenPos.x}
            cy={playerScreenPos.y}
            r={7}
            color="#FAF0CA"
          />
          {/* Facing indicator */}
          <Circle
            cx={playerScreenPos.x + facingOffset.x}
            cy={playerScreenPos.y + facingOffset.y}
            r={3.5}
            color="#9E2A2B"
          />
        </Group>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F171E',
    overflow: 'hidden',
  },
});
