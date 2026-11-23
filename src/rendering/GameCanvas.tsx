import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Line, Rect, useCanvasRef } from '@shopify/react-native-skia';
import { RenderProjection } from '@/game/application/GameProjection';
import { GameRuntime } from '@/game/engine/GameRuntime';
import { calculateVisibleTileBounds, worldToScreenPosition } from './CameraRenderer';

export interface GameCanvasProps {
  readonly runtime: GameRuntime;
  readonly width: number;
  readonly height: number;
}

// Color palette for data-driven tile types
const TILE_COLORS: Record<number, string> = {
  1: '#2A5528', // Grass
  2: '#7F5539', // Dirt road
  3: '#4A4E69', // Cobblestone plaza
  4: '#1D3557', // Water (solid)
  5: '#E63946', // Flower patch
  6: '#1E3F20', // Bush
  7: '#524B4B', // Wall / border stone (solid)
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  runtime,
  width,
  height,
}) => {
  const canvasRef = useCanvasRef();
  const projectionRef = useRef<RenderProjection>(runtime.createProjection());

  useEffect(() => {
    // Decoupled imperative subscriber: updates projection reference and triggers
    // Skia redraw imperatively WITHOUT triggering React reconciliation or setState per frame.
    const unsubscribe = runtime.subscribe((newProj) => {
      projectionRef.current = newProj;
      canvasRef.current?.redraw();
    });
    return unsubscribe;
  }, [runtime, canvasRef]);

  const projection = projectionRef.current;
  const { player, enemies, pickups, camera, map } = projection;
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

  // Walk cycle bounce offset based on animation frame
  const walkBobOffset = useMemo(() => {
    if (player.animation.state === 'walk') {
      // Bob up slightly on frames 1 and 3
      return player.animation.frame % 2 === 1 ? -2 : 0;
    }
    return 0;
  }, [player.animation]);

  // Player Facing indicator offset
  const playerFacingOffset = useMemo(() => {
    const radius = 11;
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

  // Player attack slash offset
  const attackSlashCoords = useMemo(() => {
    if (!player.isAttacking) return null;
    const distance = 26;
    switch (player.facing) {
      case 'up':
        return {
          p1: { x: playerScreenPos.x - 18, y: playerScreenPos.y - distance },
          p2: { x: playerScreenPos.x + 18, y: playerScreenPos.y - distance },
        };
      case 'down':
        return {
          p1: { x: playerScreenPos.x - 18, y: playerScreenPos.y + distance },
          p2: { x: playerScreenPos.x + 18, y: playerScreenPos.y + distance },
        };
      case 'left':
        return {
          p1: { x: playerScreenPos.x - distance, y: playerScreenPos.y - 18 },
          p2: { x: playerScreenPos.x - distance, y: playerScreenPos.y + 18 },
        };
      case 'right':
        return {
          p1: { x: playerScreenPos.x + distance, y: playerScreenPos.y - 18 },
          p2: { x: playerScreenPos.x + distance, y: playerScreenPos.y + 18 },
        };
    }
  }, [player.isAttacking, player.facing, playerScreenPos]);

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
      <Canvas ref={canvasRef} style={{ width, height }}>
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

        {/* Render Ground Pickups */}
        {pickups?.map((pickup) => {
          const pickupPos = worldToScreenPosition(pickup.position, cameraState);
          if (
            pickupPos.x < -20 ||
            pickupPos.x > width + 20 ||
            pickupPos.y < -20 ||
            pickupPos.y > height + 20
          ) {
            return null;
          }

          let pickupColor = '#FAF0CA';
          if (pickup.itemId.includes('potion')) {
            pickupColor = '#E63946'; // Red potion
          } else if (pickup.itemId.includes('sword') || pickup.itemId.includes('rapier')) {
            pickupColor = '#48CAE4'; // Blue/Steel weapon
          } else if (pickup.itemId.includes('ring') || pickup.itemId.includes('talisman')) {
            pickupColor = '#FFD166'; // Gold accessory
          } else if (
            pickup.itemId.includes('tunic') ||
            pickup.itemId.includes('chainmail') ||
            pickup.itemId.includes('helmet') ||
            pickup.itemId.includes('cap')
          ) {
            pickupColor = '#90BE6D'; // Green/Armor
          }

          return (
            <Group key={pickup.id}>
              {/* Pickup Shadow */}
              <Circle
                cx={pickupPos.x}
                cy={pickupPos.y + 4}
                r={6}
                color="rgba(0, 0, 0, 0.4)"
              />
              {/* Pickup Glowing Outer Ring */}
              <Circle
                cx={pickupPos.x}
                cy={pickupPos.y}
                r={7}
                color="rgba(255, 255, 255, 0.3)"
              />
              {/* Pickup Core */}
              <Circle
                cx={pickupPos.x}
                cy={pickupPos.y}
                r={4.5}
                color={pickupColor}
              />
            </Group>
          );
        })}

        {/* Render Enemies */}
        {enemies.map((enemy) => {
          const enemyPos = worldToScreenPosition(enemy.position, cameraState);
          if (
            enemyPos.x < -32 ||
            enemyPos.x > width + 32 ||
            enemyPos.y < -32 ||
            enemyPos.y > height + 32
          ) {
            return null;
          }

          if (enemy.state === 'dead') {
            return (
              <Group key={enemy.id}>
                <Circle cx={enemyPos.x} cy={enemyPos.y} r={10} color="#33272A" />
                <Circle cx={enemyPos.x} cy={enemyPos.y} r={5} color="#1E1618" />
              </Group>
            );
          }

          const isHurt = enemy.state === 'hurt';
          const isAttacking = enemy.state === 'attack';
          const bodyColor = isHurt ? '#E63946' : isAttacking ? '#D90429' : '#2D6A4F';

          const hpRatio = Math.max(0, Math.min(1, enemy.currentHealth / enemy.maxHealth));

          return (
            <Group key={enemy.id}>
              {/* Shadow */}
              <Circle
                cx={enemyPos.x}
                cy={enemyPos.y + 9}
                r={11}
                color="rgba(0, 0, 0, 0.4)"
              />
              {/* Enemy Body */}
              <Circle cx={enemyPos.x} cy={enemyPos.y} r={11} color={bodyColor} />
              {/* Goblin Eye / Crest */}
              <Circle cx={enemyPos.x} cy={enemyPos.y} r={5} color="#D8F3DC" />

              {/* Enemy Health Bar */}
              <Rect
                x={enemyPos.x - 12}
                y={enemyPos.y - 18}
                width={24}
                height={3}
                color="#1A1829"
              />
              <Rect
                x={enemyPos.x - 12}
                y={enemyPos.y - 18}
                width={24 * hpRatio}
                height={3}
                color={hpRatio > 0.4 ? '#52B788' : '#E63946'}
              />
            </Group>
          );
        })}

        {/* Render Player Character */}
        {player.isDead ? (
          <Group>
            <Rect
              x={playerScreenPos.x - 8}
              y={playerScreenPos.y - 12}
              width={16}
              height={22}
              color="#555B6E"
            />
            <Circle cx={playerScreenPos.x} cy={playerScreenPos.y - 12} r={8} color="#555B6E" />
          </Group>
        ) : (
          <Group>
            {/* Player Shadow */}
            <Circle
              cx={playerScreenPos.x}
              cy={playerScreenPos.y + 11}
              r={13}
              color="rgba(0, 0, 0, 0.45)"
            />
            {/* Hero Body with Walk Bobbing Offset */}
            <Circle
              cx={playerScreenPos.x}
              cy={playerScreenPos.y + walkBobOffset}
              r={13}
              color={player.isInvulnerable ? '#E63946' : '#E5A93C'}
            />
            {/* Hero Crest */}
            <Circle
              cx={playerScreenPos.x}
              cy={playerScreenPos.y + walkBobOffset}
              r={7}
              color="#FAF0CA"
            />
            {/* Facing Indicator */}
            <Circle
              cx={playerScreenPos.x + playerFacingOffset.x}
              cy={playerScreenPos.y + playerFacingOffset.y + walkBobOffset}
              r={3.5}
              color="#9E2A2B"
            />

            {/* Attack Slash Effect */}
            {attackSlashCoords && (
              <Line
                p1={attackSlashCoords.p1}
                p2={attackSlashCoords.p2}
                color="#FAF0CA"
                strokeWidth={4}
              />
            )}
          </Group>
        )}
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
