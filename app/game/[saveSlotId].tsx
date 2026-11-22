import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  useWindowDimensions,
  AppState,
  AppStateStatus,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GameCanvas } from '@/rendering/GameCanvas';
import { GameRuntime } from '@/game/engine/GameRuntime';
import { RenderProjection } from '@/game/application/GameProjection';
import { VILLAGE_OUTSKIRTS_MAP } from '@/game/content/definitions/maps';

export default function GameplayScreen() {
  const router = useRouter();
  const { saveSlotId } = useLocalSearchParams<{ saveSlotId: string }>();
  const { width, height } = useWindowDimensions();

  const runtimeRef = useRef<GameRuntime | null>(null);
  const [projection, setProjection] = useState<RenderProjection | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Initialize runtime
  useEffect(() => {
    const runtime = new GameRuntime(
      saveSlotId || 'slot_1',
      VILLAGE_OUTSKIRTS_MAP,
      width,
      height
    );
    runtimeRef.current = runtime;

    const unsubscribe = runtime.subscribe((newProj) => {
      setProjection(newProj);
    });

    runtime.start();

    // App state listener for background pause
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState.match(/inactive|background/)) {
        runtime.pause();
        setIsPaused(true);
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      sub.remove();
      unsubscribe();
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [saveSlotId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize camera viewport on orientation / dimension change
  useEffect(() => {
    if (runtimeRef.current) {
      runtimeRef.current.setViewportDimensions(width, height);
    }
  }, [width, height]);

  // Touch controls movement handlers
  const handleMoveStart = useCallback((dx: number, dy: number) => {
    runtimeRef.current?.input.setMovement(dx, dy);
  }, []);

  const handleMoveEnd = useCallback(() => {
    runtimeRef.current?.input.setMovement(0, 0);
  }, []);

  // Attack handler
  const handleAttack = useCallback(() => {
    runtimeRef.current?.triggerPlayerAttack();
  }, []);

  // Respawn handler
  const handleRespawn = useCallback(() => {
    runtimeRef.current?.respawnPlayer();
  }, []);

  // Pause / Resume handlers
  const handleTogglePause = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    if (runtime.isPaused) {
      runtime.resume();
      setIsPaused(false);
    } else {
      runtime.pause();
      setIsPaused(true);
    }
  }, []);

  const handleReturnToMenu = useCallback(() => {
    runtimeRef.current?.dispose();
    router.replace('/');
  }, [router]);

  if (!projection) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Entering the Lost Realm...</Text>
      </SafeAreaView>
    );
  }

  const { player, enemies, camera, map, stats } = projection;
  const aliveEnemies = enemies.filter((e) => e.state !== 'dead').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Full-screen Skia Game Canvas */}
        <GameCanvas projection={projection} width={width} height={height} />

        {/* Top HUD */}
        <View style={styles.topHud}>
          <View style={styles.hudCard}>
            <Text style={styles.hudMapName}>{map.name}</Text>
            <Text style={styles.hudCoords}>
              X: {Math.round(player.position.x)}  Y: {Math.round(player.position.y)}
            </Text>
          </View>

          <View style={styles.hudCenter}>
            <View style={styles.hpBarContainer}>
              <View
                style={[
                  styles.hpBarFill,
                  {
                    width: `${Math.max(
                      0,
                      Math.min(100, (player.currentHealth / player.maxHealth) * 100)
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.hpText}>
              HP: {player.currentHealth}/{player.maxHealth} • Goblins: {aliveEnemies}
            </Text>
          </View>

          <TouchableOpacity style={styles.pauseBtn} onPress={handleTogglePause}>
            <Text style={styles.pauseBtnText}>PAUSE</Text>
          </TouchableOpacity>
        </View>

        {/* Touch Controls Overlay: Left D-Pad, Right Attack Button */}
        <View style={styles.controlsOverlay} pointerEvents="box-none">
          {/* Left D-Pad */}
          <View style={styles.dpadContainer}>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPressIn={() => handleMoveStart(0, -1)}
              onPressOut={handleMoveEnd}
              accessibilityLabel="Move North"
            >
              <Text style={styles.dpadIcon}>▲</Text>
            </TouchableOpacity>

            <View style={styles.dpadMiddleRow}>
              <TouchableOpacity
                style={styles.dpadBtn}
                onPressIn={() => handleMoveStart(-1, 0)}
                onPressOut={handleMoveEnd}
                accessibilityLabel="Move West"
              >
                <Text style={styles.dpadIcon}>◀</Text>
              </TouchableOpacity>
              <View style={styles.dpadSpacer} />
              <TouchableOpacity
                style={styles.dpadBtn}
                onPressIn={() => handleMoveStart(1, 0)}
                onPressOut={handleMoveEnd}
                accessibilityLabel="Move East"
              >
                <Text style={styles.dpadIcon}>▶</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.dpadBtn}
              onPressIn={() => handleMoveStart(0, 1)}
              onPressOut={handleMoveEnd}
              accessibilityLabel="Move South"
            >
              <Text style={styles.dpadIcon}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Right Action Button: Attack */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[
                styles.attackBtn,
                player.isAttacking && styles.attackBtnActive,
              ]}
              onPress={handleAttack}
              activeOpacity={0.7}
              accessibilityLabel="Attack with Sword"
            >
              <Text style={styles.attackBtnText}>⚔️ ATTACK</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pause Modal */}
        <Modal visible={isPaused && !player.isDead} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>GAME PAUSED</Text>
              <Text style={styles.modalSubtitle}>Simulation updates suspended</Text>

              <View style={styles.modalStats}>
                <Text style={styles.statLine}>
                  Steps simulated: <Text style={styles.statVal}>{stats.stepCount}</Text>
                </Text>
                <Text style={styles.statLine}>
                  Play time: <Text style={styles.statVal}>{stats.elapsedTimeSeconds.toFixed(1)}s</Text>
                </Text>
                <Text style={styles.statLine}>
                  Camera focus: <Text style={styles.statVal}>({Math.round(camera.position.x)}, {Math.round(camera.position.y)})</Text>
                </Text>
                <Text style={styles.statLine}>
                  Enemies remaining: <Text style={styles.statVal}>{aliveEnemies}</Text>
                </Text>
              </View>

              <TouchableOpacity style={styles.modalResumeBtn} onPress={handleTogglePause}>
                <Text style={styles.modalBtnText}>RESUME</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalMenuBtn} onPress={handleReturnToMenu}>
                <Text style={styles.modalBtnText}>MAIN MENU</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Game Over / Death Modal */}
        <Modal visible={player.isDead} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { borderColor: '#E63946' }]}>
              <Text style={[styles.modalTitle, { color: '#E63946' }]}>YOU DIED</Text>
              <Text style={styles.modalSubtitle}>Defeated by corrupted creatures</Text>

              <TouchableOpacity style={[styles.modalResumeBtn, { backgroundColor: '#8B0000', borderColor: '#E63946' }]} onPress={handleRespawn}>
                <Text style={styles.modalBtnText}>RESPAWN AT VILLAGE</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalMenuBtn} onPress={handleReturnToMenu}>
                <Text style={styles.modalBtnText}>RETURN TO MENU</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07060A',
  },
  container: {
    flex: 1,
    backgroundColor: '#07060A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#07060A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FAF0CA',
    fontSize: 16,
    fontWeight: 'bold',
  },
  topHud: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudCard: {
    backgroundColor: 'rgba(20, 17, 33, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3D3560',
  },
  hudMapName: {
    color: '#FAF0CA',
    fontSize: 13,
    fontWeight: 'bold',
  },
  hudCoords: {
    color: '#9E9AA7',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  hudCenter: {
    alignItems: 'center',
  },
  hpBarContainer: {
    width: 150,
    height: 10,
    backgroundColor: '#27223D',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4A4170',
  },
  hpBarFill: {
    height: '100%',
    backgroundColor: '#48BB78',
  },
  hpText: {
    color: '#EDE8F5',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 2,
  },
  pauseBtn: {
    backgroundColor: '#2E274C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#544782',
  },
  pauseBtnText: {
    color: '#FAF0CA',
    fontSize: 11,
    fontWeight: 'bold',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dpadContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(18, 15, 30, 0.75)',
    padding: 6,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: '#38305A',
  },
  dpadMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dpadSpacer: {
    width: 44,
    height: 44,
  },
  dpadBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#2F274D',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#50447C',
  },
  dpadIcon: {
    color: '#FAF0CA',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionContainer: {
    alignItems: 'center',
  },
  attackBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#9E2A2B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#E63946',
    elevation: 4,
  },
  attackBtnActive: {
    backgroundColor: '#D90429',
    borderColor: '#FFF',
  },
  attackBtnText: {
    color: '#FAF0CA',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: 320,
    backgroundColor: '#19152B',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#4C407A',
  },
  modalTitle: {
    color: '#FAF0CA',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modalSubtitle: {
    color: '#9E9AA7',
    fontSize: 11,
    marginVertical: 4,
  },
  modalStats: {
    width: '100%',
    backgroundColor: '#110E1E',
    padding: 10,
    borderRadius: 8,
    marginVertical: 12,
  },
  statLine: {
    color: '#D4CEE3',
    fontSize: 11,
    marginVertical: 2,
  },
  statVal: {
    color: '#E5A93C',
    fontWeight: 'bold',
  },
  modalResumeBtn: {
    width: '100%',
    backgroundColor: '#3E3466',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6758A3',
    marginBottom: 8,
  },
  modalMenuBtn: {
    width: '100%',
    backgroundColor: '#27223D',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#433A6B',
  },
  modalBtnText: {
    color: '#FAF0CA',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
