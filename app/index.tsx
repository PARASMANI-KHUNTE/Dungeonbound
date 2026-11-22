import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  initDatabase,
  getPersistenceProbe,
  recordPersistenceProbe,
  PersistenceProbeRecord,
} from '@/platform/persistence/database';

export default function MainMenuScreen() {
  const router = useRouter();
  const [probe, setProbe] = useState<PersistenceProbeRecord | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        const rec = await recordPersistenceProbe('Main menu loaded');
        setProbe(rec);
      } catch (err) {
        console.error('Database probe error', err);
      }
    })();
  }, []);

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

        {/* Menu Buttons */}
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/game/slot_1')}
          >
            <Text style={styles.primaryButtonText}>START ADVENTURE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/game/slot_1')}
          >
            <Text style={styles.secondaryButtonText}>CONTINUE</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Persistence & System Status */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Local SQLite Active • Launch Count: {probe ? probe.launchCount : '...'} • Zero Network Dependencies
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
    padding: 20,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FAF0CA',
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 14,
    color: '#E5A93C',
    letterSpacing: 2,
    marginTop: 2,
  },
  badge: {
    marginTop: 8,
    backgroundColor: '#1C182E',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3C3361',
  },
  badgeText: {
    color: '#63B3ED',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  menuSection: {
    width: 240,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#4B3E7A',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#7562BF',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FAF0CA',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: '#1E1933',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#39305D',
  },
  secondaryButtonText: {
    color: '#C7BFE0',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 12,
  },
  footerText: {
    color: '#766F8A',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
