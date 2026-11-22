import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Line, Rect } from '@shopify/react-native-skia';
import { Direction } from '@/game/domain/value-objects/Transform';
import { Vector2 } from '@/game/domain/value-objects/Vector2';

export interface GameCanvasProps {
  readonly width: number;
  readonly height: number;
  readonly playerPosition: Vector2;
  readonly playerFacing: Direction;
  readonly tileSize?: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  width,
  height,
  playerPosition,
  playerFacing,
  tileSize = 32,
}) => {
  const cols = Math.ceil(width / tileSize);
  const rows = Math.ceil(height / tileSize);

  const tiles = useMemo(() => {
    const list: Array<{ x: number; y: number; isAlt: boolean; isBorder: boolean }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isBorder = r === 0 || c === 0 || r === rows - 1 || c === cols - 1;
        const isAlt = (r + c) % 2 === 1;
        list.push({ x: c * tileSize, y: r * tileSize, isAlt, isBorder });
      }
    }
    return list;
  }, [cols, rows, tileSize]);

  // Compute facing indicator offset
  const facingOffset = useMemo(() => {
    const radius = 10;
    switch (playerFacing) {
      case 'up':
        return { x: 0, y: -radius };
      case 'down':
        return { x: 0, y: radius };
      case 'left':
        return { x: -radius, y: 0 };
      case 'right':
        return { x: radius, y: 0 };
    }
  }, [playerFacing]);

  return (
    <View style={[styles.container, { width, height }]}>
      <Canvas style={{ width, height }}>
        {/* Background Dungeon Tiles */}
        {tiles.map((tile, idx) => (
          <Rect
            key={idx}
            x={tile.x}
            y={tile.y}
            width={tileSize}
            height={tileSize}
            color={tile.isBorder ? '#1A1829' : tile.isAlt ? '#25213B' : '#2D2845'}
          />
        ))}

        {/* Subtle Grid Lines */}
        {Array.from({ length: cols + 1 }).map((_, i) => (
          <Line
            key={`vl-${i}`}
            p1={{ x: i * tileSize, y: 0 }}
            p2={{ x: i * tileSize, y: height }}
            color="#383256"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: rows + 1 }).map((_, j) => (
          <Line
            key={`hl-${j}`}
            p1={{ x: 0, y: j * tileSize }}
            p2={{ x: width, y: j * tileSize }}
            color="#383256"
            strokeWidth={1}
          />
        ))}

        {/* Placeholder Player Character */}
        <Group>
          {/* Shadow */}
          <Circle
            cx={playerPosition.x}
            cy={playerPosition.y + 10}
            r={12}
            color="rgba(0, 0, 0, 0.45)"
          />
          {/* Hero Body */}
          <Circle
            cx={playerPosition.x}
            cy={playerPosition.y}
            r={12}
            color="#E5A93C"
          />
          {/* Hero Crest / Core */}
          <Circle
            cx={playerPosition.x}
            cy={playerPosition.y}
            r={7}
            color="#FAF0CA"
          />
          {/* Facing Direction Indicator */}
          <Circle
            cx={playerPosition.x + facingOffset.x}
            cy={playerPosition.y + facingOffset.y}
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
    backgroundColor: '#12101E',
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#433D6B',
  },
});
