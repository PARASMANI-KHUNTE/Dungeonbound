import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  initDatabase,
  recordPersistenceProbe,
  getSaveRepository,
  PersistenceProbeRecord,
} from '@/platform/persistence/database';
import { SaveSlotSummary } from '@/game/domain/repositories/SaveRepository';

export default function MainMenuScreen() {
  const router = useRouter();
  const [probe, setProbe] = useState<PersistenceProbeRecord | null>(null);
  const [slots, setSlots] = useState<readonly SaveSlotSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSlots = useCallback(async () => {
    try {
      const repo = await getSaveRepository();
      let slotList = await repo.listSlots();
      if (slotList.length === 0) {
        // Initialize default 3 slots
        await repo.createSlot(1, 'Hero Slot 1');
        await repo.createSlot(2, 'Hero Slot 2');
        await repo.createSlot(3, 'Hero Slot 3');
        slotList = await repo.listSlots();
      }
      setSlots(slotList);
    } catch (err) {
      console.error('Error loading save slots', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        const rec = await recordPersistenceProbe('Main menu loaded');
        setProbe(rec);
        await loadSlots();
      } catch (err) {
        console.error('Database probe error', err);
      }
    })();
  }, [loadSlots]);

  const handleDeleteSlot = (slot: SaveSlotSummary) => {
    Alert.alert(
      'Delete Save Slot',
      `Are you sure you want to delete ${slot.displayName}? All progress in this slot will be permanently erased.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const repo = await getSaveRepository();
              await repo.deleteSlot(slot.id);
              await repo.createSlot(slot.slotNumber, slot.displayName);
              await loadSlots();
            } catch (err) {
              console.error('Error deleting slot', err);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Title Banner */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>DUNGEONBOUND</Text>
          <Text style={styles.subtitle}>The Lost Realm</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>OFFLINE SINGLE-PLAYER</Text>
          </View>
        </View>

        {/* Save Slots List */}
        <View style={styles.slotsSection}>
          <Text style={styles.slotsHeader}>SELECT SAVE ADVENTURE</Text>
          {loading ? (
            <Text style={styles.loadingSlotsText}>Loading saved games...</Text>
          ) : (
            <ScrollView style={styles.slotsScroll} showsVerticalScrollIndicator={false}>
              {slots.map((slot) => (
                <View key={slot.id} style={styles.slotCard}>
                  <View style={styles.slotDetails}>
                    <Text style={styles.slotTitle}>
                      Slot {slot.slotNumber}: {slot.displayName}
                    </Text>
                    {slot.hasData ? (
                      <Text style={styles.slotMeta}>
                        Level {slot.level} Hero • {slot.playTimeSeconds}s played
                      </Text>
                    ) : (
                      <Text style={styles.slotEmptyMeta}>[ Empty Slot ]</Text>
                    )}
                  </View>

                  <View style={styles.slotActions}>
                    <TouchableOpacity
                      style={slot.hasData ? styles.playBtn : styles.newGameBtn}
                      onPress={() => router.push(`/game/${slot.id}`)}
                    >
                      <Text style={styles.actionBtnText}>
                        {slot.hasData ? 'PLAY' : 'NEW GAME'}
                      </Text>
                    </TouchableOpacity>

                    {slot.hasData && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteSlot(slot)}
                      >
                        <Text style={styles.deleteBtnText}>DEL</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Footer Persistence & System Status */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Durable SQLite Active • Boots: {probe ? probe.launchCount : '...'} • Airplane Mode Ready
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#08070D',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FAF0CA',
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 13,
    color: '#E5A93C',
    letterSpacing: 2,
    marginTop: 2,
  },
  badge: {
    marginTop: 6,
    backgroundColor: '#1E1B2E',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4A4170',
  },
  badgeText: {
    color: '#90BE6D',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  slotsSection: {
    width: '90%',
    maxHeight: 180,
    backgroundColor: '#12101C',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2E274C',
    padding: 10,
  },
  slotsHeader: {
    color: '#E5A93C',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 1,
  },
  loadingSlotsText: {
    color: '#8E9AAF',
    fontSize: 11,
    textAlign: 'center',
    padding: 12,
  },
  slotsScroll: {
    flex: 1,
  },
  slotCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1B172E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3D3560',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
  },
  slotDetails: {
    flex: 1,
  },
  slotTitle: {
    color: '#FAF0CA',
    fontSize: 12,
    fontWeight: 'bold',
  },
  slotMeta: {
    color: '#52B788',
    fontSize: 10,
    marginTop: 1,
  },
  slotEmptyMeta: {
    color: '#6C757D',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 1,
  },
  slotActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playBtn: {
    backgroundColor: '#2A9D8F',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 5,
  },
  newGameBtn: {
    backgroundColor: '#E76F51',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  deleteBtn: {
    backgroundColor: '#33272A',
    borderWidth: 1,
    borderColor: '#E63946',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  deleteBtnText: {
    color: '#E63946',
    fontSize: 9,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 14,
  },
  footerText: {
    color: '#8E9AA7',
    fontSize: 10,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});
