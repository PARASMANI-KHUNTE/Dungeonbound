import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { GameCanvas } from '@/rendering/GameCanvas';
import {
  initDatabase,
  recordPersistenceProbe,
  PersistenceProbeRecord,
} from '@/platform/persistence/database';
import { createTransform } from '@/game/domain/value-objects/Transform';
import { createVector2 } from '@/game/domain/value-objects/Vector2';
import { applyMovementStep } from '@/game/domain/rules/MovementRules';

export default function SpikeScreen() {
  const { width, height } = useWindowDimensions();

  // SQLite Persistence State
  const [probeRecord, setProbeRecord] = useState<PersistenceProbeRecord | null>(null);
  const [dbStatus, setDbStatus] = useState<'INITIALIZING' | 'READY' | 'ERROR'>('INITIALIZING');
  const [dbError, setDbError] = useState<string | null>(null);

  // Player Transform State for Technical Spike
  const [playerTransform, setPlayerTransform] = useState(() =>
    createTransform(createVector2(160, 120), 'down')
  );

  // Initialize SQLite on boot and prove persistence
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await initDatabase();
        const probe = await recordPersistenceProbe('App mounted in offline spike');
        if (isMounted) {
          setProbeRecord(probe);
          setDbStatus('READY');
        }
      } catch (err) {
        if (isMounted) {
          setDbStatus('ERROR');
          setDbError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSimulateRestart = useCallback(async () => {
    try {
      const updated = await recordPersistenceProbe('Manual restart simulation');
      setProbeRecord(updated);
    } catch (err) {
      setDbError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Canvas bounds
  const canvasWidth = Math.max(320, Math.min(width - 260, 600));
  const canvasHeight = Math.max(220, Math.min(height - 40, 360));

  const handleMove = useCallback((dx: number, dy: number) => {
    setPlayerTransform((prev) =>
      applyMovementStep({
        currentTransform: prev,
        inputVector: createVector2(dx, dy),
        speedUnitsPerSecond: 24,
        deltaSeconds: 1.0,
        bounds: {
          minX: 32,
          minY: 32,
          maxX: canvasWidth - 32,
          maxY: canvasHeight - 32,
        },
      })
    );
  }, [canvasWidth, canvasHeight]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Left Side: Game Canvas (Skia Tile Grid + Character) */}
        <View style={styles.canvasWrapper}>
          <GameCanvas
            width={canvasWidth}
            height={canvasHeight}
            playerPosition={playerTransform.position}
            playerFacing={playerTransform.facing}
            tileSize={32}
          />
          {/* D-Pad Controls for Spike Verification */}
          <View style={styles.dpad}>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPress={() => handleMove(0, -1)}
              accessibilityLabel="Move Up"
            >
              <Text style={styles.dpadText}>▲</Text>
            </TouchableOpacity>
            <View style={styles.dpadRow}>
              <TouchableOpacity
                style={styles.dpadBtn}
                onPress={() => handleMove(-1, 0)}
                accessibilityLabel="Move Left"
              >
                <Text style={styles.dpadText}>◀</Text>
              </TouchableOpacity>
              <View style={styles.dpadCenter} />
              <TouchableOpacity
                style={styles.dpadBtn}
                onPress={() => handleMove(1, 0)}
                accessibilityLabel="Move Right"
              >
                <Text style={styles.dpadText}>▶</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPress={() => handleMove(0, 1)}
              accessibilityLabel="Move Down"
            >
              <Text style={styles.dpadText}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Side: Technical Spike Diagnostic Panel */}
        <View style={styles.panel}>
          <Text style={styles.title}>Dungeonbound</Text>
          <Text style={styles.subtitle}>Phase 0 Technical Spike</Text>

          <View style={styles.card}>
            <Text style={styles.cardHeader}>SQLite Persistence Proof</Text>
            <Text style={styles.cardItem}>
              Database Status:{' '}
              <Text
                style={{
                  color:
                    dbStatus === 'READY'
                      ? '#48BB78'
                      : dbStatus === 'ERROR'
                      ? '#F56565'
                      : '#ECC94B',
                }}
              >
                {dbStatus}
              </Text>
            </Text>
            {probeRecord && (
              <>
                <Text style={styles.cardItem}>
                  Total Launches / Restarts:{' '}
                  <Text style={styles.highlight}>{probeRecord.launchCount}</Text>
                </Text>
                <Text style={styles.cardItem}>
                  Last Boot:{' '}
                  <Text style={styles.code}>
                    {new Date(probeRecord.lastBootAt).toLocaleTimeString()}
                  </Text>
                </Text>
              </>
            )}
            {dbError && <Text style={styles.errorText}>{dbError}</Text>}

            <TouchableOpacity style={styles.button} onPress={handleSimulateRestart}>
              <Text style={styles.buttonText}>Increment Launch Probe (Write+Read)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeader}>Pure Domain Invariants</Text>
            <Text style={styles.cardItem}>
              Position:{' '}
              <Text style={styles.code}>
                ({Math.round(playerTransform.position.x)}, {Math.round(playerTransform.position.y)})
              </Text>
            </Text>
            <Text style={styles.cardItem}>
              Facing: <Text style={styles.highlight}>{playerTransform.facing.toUpperCase()}</Text>
            </Text>
            <Text style={styles.cardItem}>
              Orientation: <Text style={styles.highlight}>Landscape</Text>
            </Text>
            <Text style={styles.cardItem}>
              Network: <Text style={styles.highlight}>100% Offline (Zero Calls)</Text>
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0A12',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  canvasWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpad: {
    marginTop: 8,
    alignItems: 'center',
  },
  dpadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  dpadCenter: {
    width: 36,
    height: 36,
  },
  dpadBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#27223D',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4E4675',
  },
  dpadText: {
    color: '#EDE8F5',
    fontSize: 16,
    fontWeight: 'bold',
  },
  panel: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FAF0CA',
  },
  subtitle: {
    fontSize: 12,
    color: '#9E9AA7',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#181528',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2F294C',
  },
  cardHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#E5A93C',
    marginBottom: 4,
  },
  cardItem: {
    fontSize: 11,
    color: '#D4CEE3',
    marginVertical: 1,
  },
  highlight: {
    color: '#63B3ED',
    fontWeight: 'bold',
  },
  code: {
    color: '#ED8936',
    fontFamily: 'monospace',
    fontSize: 10,
  },
  errorText: {
    color: '#FC8181',
    fontSize: 11,
    marginTop: 4,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#3B3360',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5D5294',
  },
  buttonText: {
    color: '#FAF0CA',
    fontSize: 11,
    fontWeight: '600',
  },
});
