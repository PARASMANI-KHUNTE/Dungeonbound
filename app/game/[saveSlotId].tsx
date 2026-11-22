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
import { UiProjection } from '@/game/application/GameProjection';
import { VirtualJoystick } from '@/input/VirtualJoystick';
import { Vector2 } from '@/game/domain/value-objects/Vector2';
import { VILLAGE_OUTSKIRTS_MAP } from '@/game/content/definitions/maps';
import { InventoryModal } from '@/ui/components/InventoryModal';
import { getSaveRepository } from '@/platform/persistence/database';

export default function GameplayScreen() {
  const router = useRouter();
  const { saveSlotId } = useLocalSearchParams<{ saveSlotId: string }>();
  const { width, height } = useWindowDimensions();

  const runtimeRef = useRef<GameRuntime | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [controlMode, setControlMode] = useState<'JOYSTICK' | 'DPAD'>('JOYSTICK');
  const [inventoryVisible, setInventoryVisible] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Throttled UI State (10 Hz cadence or on discrete events - NO 60 FPS React re-renders!)
  const [uiState, setUiState] = useState<UiProjection | null>(null);

  // Initialize runtime and hydrate save slot if present
  useEffect(() => {
    const runtime = new GameRuntime(
      saveSlotId || 'slot_1',
      VILLAGE_OUTSKIRTS_MAP,
      width,
      height
    );
    runtimeRef.current = runtime;

    // Hydrate existing save slot
    (async () => {
      try {
        const repo = await getSaveRepository();
        const existing = await repo.loadSnapshot(saveSlotId || 'slot_1');
        if (existing) {
          runtime.loadFromSnapshot(existing);
        }
      } catch (err) {
        console.warn('Could not load existing save snapshot', err);
      }
    })();

    // Subscribe ONLY to throttled UI projection (100ms throttle)
    const unsubscribeUi = runtime.subscribeUI((newUi) => {
      setUiState(newUi);
    }, 100);

    runtime.start();
    setRuntimeReady(true);

    // App state listener for background pause and auto-save
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState.match(/inactive|background/)) {
        runtime.pause();
        try {
          const repo = await getSaveRepository();
          const snapshot = runtime.createSaveSnapshot();
          await repo.saveSnapshot(saveSlotId || 'slot_1', snapshot);
        } catch (err) {
          console.warn('Background auto-save failed', err);
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      sub.remove();
      unsubscribeUi();
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [saveSlotId]);

  // Resize camera viewport on dimension change
  useEffect(() => {
    if (runtimeRef.current) {
      runtimeRef.current.setViewportDimensions(width, height);
    }
  }, [width, height]);

  // Analog Joystick movement handler
  const handleJoystickMove = useCallback((vec: Vector2) => {
    runtimeRef.current?.input.setMovement(vec.x, vec.y);
  }, []);

  // D-Pad movement handlers
  const handleDpadMoveStart = useCallback((dx: number, dy: number) => {
    runtimeRef.current?.input.setMovement(dx, dy);
  }, []);

  const handleDpadMoveEnd = useCallback(() => {
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
    } else {
      runtime.pause();
    }
  }, []);

  const handleToggleControlMode = useCallback(() => {
    setControlMode((prev) => (prev === 'JOYSTICK' ? 'DPAD' : 'JOYSTICK'));
  }, []);

  const handleSaveGame = useCallback(async () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    try {
      const repo = await getSaveRepository();
      const snapshot = runtime.createSaveSnapshot();
      await repo.saveSnapshot(saveSlotId || 'slot_1', snapshot);
      setSaveStatus('Game Progress Saved!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(`Save failed: ${err.message}`);
    }
  }, [saveSlotId]);

  const handleReturnToMenu = useCallback(() => {
    runtimeRef.current?.dispose();
    router.replace('/');
  }, [router]);

  if (!runtimeReady || !runtimeRef.current || !uiState) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Entering the Lost Realm...</Text>
      </SafeAreaView>
    );
  }

  const {
    playerHealth,
    playerMaxHealth,
    playerCoords,
    mapName,
    isDead,
    isPaused,
    aliveEnemyCount,
    totalSteps,
    elapsedTimeSeconds,
  } = uiState;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Full-screen Skia Game Canvas (driven directly by runtime without parent re-renders) */}
        <GameCanvas runtime={runtimeRef.current} width={width} height={height} />

        {/* Top HUD */}
        <View style={styles.topHud}>
          <View style={styles.hudCard}>
            <Text style={styles.hudMapName}>{mapName}</Text>
            <Text style={styles.hudCoords}>
              X: {Math.round(playerCoords.x)}  Y: {Math.round(playerCoords.y)}
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
                      Math.min(100, (playerHealth / playerMaxHealth) * 100)
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.hpText}>
              Lvl {uiState.playerLevel} • HP: {playerHealth}/{playerMaxHealth} • Goblins: {aliveEnemyCount}
            </Text>
          </View>

          <View style={styles.topButtons}>
            <TouchableOpacity
              style={styles.inventoryBtn}
              onPress={() => {
                runtimeRef.current?.pause();
                setInventoryVisible(true);
              }}
              accessibilityLabel="Open Inventory"
            >
              <Text style={styles.inventoryBtnText}>🎒 BAG</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlModeBtn} onPress={handleToggleControlMode}>
              <Text style={styles.controlModeBtnText}>
                {controlMode === 'JOYSTICK' ? '🕹️ STICK' : '🎛️ D-PAD'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pauseBtn} onPress={handleTogglePause}>
              <Text style={styles.pauseBtnText}>PAUSE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Floating Notification Banner */}
        {uiState.notificationMessage && (
          <View style={styles.notificationBanner}>
            <Text style={styles.notificationText}>{uiState.notificationMessage}</Text>
          </View>
        )}

        {/* Touch Controls Overlay: Left Movement, Right Action */}
        <View style={styles.controlsOverlay} pointerEvents="box-none">
          {/* Movement Control: Virtual Joystick OR Directional D-Pad */}
          {controlMode === 'JOYSTICK' ? (
            <View style={styles.joystickContainer}>
              <VirtualJoystick onMove={handleJoystickMove} radius={52} knobRadius={22} deadzone={6} />
            </View>
          ) : (
            <View style={styles.dpadContainer}>
              <TouchableOpacity
                style={styles.dpadBtn}
                onPressIn={() => handleDpadMoveStart(0, -1)}
                onPressOut={handleDpadMoveEnd}
                accessibilityLabel="Move North"
              >
                <Text style={styles.dpadIcon}>▲</Text>
              </TouchableOpacity>

              <View style={styles.dpadMiddleRow}>
                <TouchableOpacity
                  style={styles.dpadBtn}
                  onPressIn={() => handleDpadMoveStart(-1, 0)}
                  onPressOut={handleDpadMoveEnd}
                  accessibilityLabel="Move West"
                >
                  <Text style={styles.dpadIcon}>◀</Text>
                </TouchableOpacity>
                <View style={styles.dpadSpacer} />
                <TouchableOpacity
                  style={styles.dpadBtn}
                  onPressIn={() => handleDpadMoveStart(1, 0)}
                  onPressOut={handleDpadMoveEnd}
                  accessibilityLabel="Move East"
                >
                  <Text style={styles.dpadIcon}>▶</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.dpadBtn}
                onPressIn={() => handleDpadMoveStart(0, 1)}
                onPressOut={handleDpadMoveEnd}
                accessibilityLabel="Move South"
              >
                <Text style={styles.dpadIcon}>▼</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Right Action Button: Attack */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.attackBtn}
              onPress={handleAttack}
              activeOpacity={0.7}
              accessibilityLabel="Attack with Sword"
            >
              <Text style={styles.attackBtnText}>⚔️ ATTACK</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Inventory Modal */}
        <InventoryModal
          visible={inventoryVisible}
          onClose={() => setInventoryVisible(false)}
          runtime={runtimeRef.current}
          uiState={uiState}
        />

        {/* Pause Modal */}
        <Modal visible={isPaused && !isDead && !inventoryVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>GAME PAUSED</Text>
              <Text style={styles.modalSubtitle}>Simulation updates suspended</Text>

              <View style={styles.modalStats}>
                <Text style={styles.statLine}>
                  Steps simulated: <Text style={styles.statVal}>{totalSteps}</Text>
                </Text>
                <Text style={styles.statLine}>
                  Play time: <Text style={styles.statVal}>{elapsedTimeSeconds.toFixed(1)}s</Text>
                </Text>
                <Text style={styles.statLine}>
                  Enemies remaining: <Text style={styles.statVal}>{aliveEnemyCount}</Text>
                </Text>
              </View>

              {saveStatus && (
                <View style={styles.modalSaveFeedback}>
                  <Text style={styles.modalSaveFeedbackText}>{saveStatus}</Text>
                </View>
              )}

              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveGame}>
                <Text style={styles.modalBtnText}>💾 SAVE PROGRESS</Text>
              </TouchableOpacity>

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
        <Modal visible={isDead} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { borderColor: '#E63946' }]}>
              <Text style={[styles.modalTitle, { color: '#E63946' }]}>YOU DIED</Text>
              <Text style={styles.modalSubtitle}>Defeated by corrupted creatures</Text>

              <TouchableOpacity
                style={[
                  styles.modalResumeBtn,
                  { backgroundColor: '#8B0000', borderColor: '#E63946' },
                ]}
                onPress={handleRespawn}
              >
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
  topButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inventoryBtn: {
    backgroundColor: '#27223D',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5A93C',
    marginRight: 6,
  },
  inventoryBtnText: {
    color: '#E5A93C',
    fontSize: 10,
    fontWeight: 'bold',
  },
  controlModeBtn: {
    backgroundColor: '#27223D',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4E4376',
    marginRight: 6,
  },
  controlModeBtnText: {
    color: '#E5A93C',
    fontSize: 10,
    fontWeight: 'bold',
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
  joystickContainer: {
    padding: 6,
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
  modalSaveFeedback: {
    backgroundColor: '#1E3F20',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#52B788',
  },
  modalSaveFeedbackText: {
    color: '#FAF0CA',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalSaveBtn: {
    width: '100%',
    backgroundColor: '#2A9D8F',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#48CAE4',
    marginBottom: 8,
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
  notificationBanner: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: '#1D3557',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#48CAE4',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 6,
  },
  notificationText: {
    color: '#FAF0CA',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
