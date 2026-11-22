import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Picture, type SkPicture } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { GameRuntime } from '@/game/engine/GameRuntime';
import {
  createDrawingResources,
  createEmptyPicture,
  drawGameFrame,
} from './drawGameFrame';

export interface GameCanvasProps {
  readonly runtime: GameRuntime;
  readonly width: number;
  readonly height: number;
}

/**
 * The canvas renders imperatively: a single Skia Picture is redrawn from a
 * requestAnimationFrame tick and published through a Reanimated shared value.
 * React renders this component once per size change, never once per game frame.
 */
export const GameCanvas: React.FC<GameCanvasProps> = ({ runtime, width, height }) => {
  const picture = useSharedValue<SkPicture>(createEmptyPicture(width, height));
  const resourcesRef = useRef(createDrawingResources());

  useEffect(() => {
    let frameHandle: number;

    const renderFrame = () => {
      const { recorder } = resourcesRef.current;
      const canvas = recorder.beginRecording({ x: 0, y: 0, width, height });
      drawGameFrame(canvas, runtime.createProjection(), resourcesRef.current, width, height);
      picture.value = recorder.finishRecordingAsPicture();
      frameHandle = requestAnimationFrame(renderFrame);
    };

    frameHandle = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(frameHandle);
  }, [runtime, width, height, picture]);

  return (
    <View style={[styles.container, { width, height }]}>
      <Canvas style={{ width, height }}>
        <Picture picture={picture} />
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
