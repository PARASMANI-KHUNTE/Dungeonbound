import React, { useRef, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { Vector2, createVector2 } from '../game/domain/value-objects/Vector2';

export interface VirtualJoystickProps {
  readonly onMove: (vector: Vector2) => void;
  readonly radius?: number;
  readonly knobRadius?: number;
  readonly deadzone?: number;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onMove,
  radius = 52,
  knobRadius = 22,
  deadzone = 6,
}) => {
  const [knobOffset, setKnobOffset] = useState<Vector2>(createVector2(0, 0));
  const touchOriginRef = useRef<Vector2 | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          touchOriginRef.current = createVector2(
            evt.nativeEvent.pageX,
            evt.nativeEvent.pageY
          );
          setKnobOffset(createVector2(0, 0));
          onMove(createVector2(0, 0));
        },
        onPanResponderMove: (
          _evt: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          const dx = gestureState.dx;
          const dy = gestureState.dy;
          const distance = Math.hypot(dx, dy);

          if (distance <= deadzone) {
            setKnobOffset(createVector2(0, 0));
            onMove(createVector2(0, 0));
            return;
          }

          // Clamp knob visual offset to outer circle radius
          const clampedDist = Math.min(distance, radius);
          const angle = Math.atan2(dy, dx);
          const visualX = Math.cos(angle) * clampedDist;
          const visualY = Math.sin(angle) * clampedDist;

          setKnobOffset(createVector2(visualX, visualY));

          // Calculate normalized continuous vector (-1..1)
          const normalizedMagnitude = (clampedDist - deadzone) / (radius - deadzone);
          const normX = Math.cos(angle) * normalizedMagnitude;
          const normY = Math.sin(angle) * normalizedMagnitude;

          onMove(createVector2(normX, normY));
        },
        onPanResponderRelease: () => {
          touchOriginRef.current = null;
          setKnobOffset(createVector2(0, 0));
          onMove(createVector2(0, 0));
        },
        onPanResponderTerminate: () => {
          // Neutral return on cancellation / interruption
          touchOriginRef.current = null;
          setKnobOffset(createVector2(0, 0));
          onMove(createVector2(0, 0));
        },
      }),
    [radius, knobRadius, deadzone, onMove]
  );

  const containerSize = radius * 2;

  return (
    <View
      style={[
        styles.base,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: radius,
        },
      ]}
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="Virtual Movement Joystick"
    >
      {/* Knob / Thumb Indicator */}
      <View
        style={[
          styles.knob,
          {
            width: knobRadius * 2,
            height: knobRadius * 2,
            borderRadius: knobRadius,
            transform: [
              { translateX: knobOffset.x },
              { translateY: knobOffset.y },
            ],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(23, 19, 38, 0.75)',
    borderWidth: 2,
    borderColor: '#4E4376',
    justifyContent: 'center',
    alignItems: 'center',
  },
  knob: {
    backgroundColor: '#E5A93C',
    borderWidth: 2,
    borderColor: '#FAF0CA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 4,
  },
});
