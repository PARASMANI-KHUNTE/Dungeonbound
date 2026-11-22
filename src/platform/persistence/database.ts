import * as SQLite from 'expo-sqlite';

export const DATABASE_NAME = 'dungeonbound.db';

export interface PersistenceProbeRecord {
  readonly id: string;
  readonly launchCount: number;
  readonly lastBootAt: string;
  readonly notes: string;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(dbName = DATABASE_NAME): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(dbName);
  }
  return dbInstance;
}

export async function initDatabase(dbName = DATABASE_NAME): Promise<SQLite.SQLiteDatabase> {
  const db = await getDatabase(dbName);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS save_slots (
      id TEXT PRIMARY KEY,
      slot_number INTEGER NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      play_time_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      save_version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS spike_persistence_probe (
      id TEXT PRIMARY KEY,
      launch_count INTEGER NOT NULL,
      last_boot_at TEXT NOT NULL,
      notes TEXT NOT NULL
    );
  `);

  return db;
}

export async function recordPersistenceProbe(
  note = 'Standard offline launch',
  dbName = DATABASE_NAME
): Promise<PersistenceProbeRecord> {
  const db = await initDatabase(dbName);
  const now = new Date().toISOString();
  const probeId = 'phase_0_spike_probe';

  const existing = await db.getFirstAsync<{
    id: string;
    launch_count: number;
    last_boot_at: string;
    notes: string;
  }>('SELECT id, launch_count, last_boot_at, notes FROM spike_persistence_probe WHERE id = ?;', [
    probeId,
  ]);

  if (!existing) {
    const initialRecord: PersistenceProbeRecord = {
      id: probeId,
      launchCount: 1,
      lastBootAt: now,
      notes: note,
    };
    await db.runAsync(
      'INSERT INTO spike_persistence_probe (id, launch_count, last_boot_at, notes) VALUES (?, ?, ?, ?);',
      [initialRecord.id, initialRecord.launchCount, initialRecord.lastBootAt, initialRecord.notes]
    );
    return initialRecord;
  }

  const nextCount = existing.launch_count + 1;
  await db.runAsync(
    'UPDATE spike_persistence_probe SET launch_count = ?, last_boot_at = ?, notes = ? WHERE id = ?;',
    [nextCount, now, note, probeId]
  );

  return {
    id: probeId,
    launchCount: nextCount,
    lastBootAt: now,
    notes: note,
  };
}

export async function getPersistenceProbe(
  dbName = DATABASE_NAME
): Promise<PersistenceProbeRecord | null> {
  const db = await initDatabase(dbName);
  const row = await db.getFirstAsync<{
    id: string;
    launch_count: number;
    last_boot_at: string;
    notes: string;
  }>('SELECT id, launch_count, last_boot_at, notes FROM spike_persistence_probe WHERE id = ?;', [
    'phase_0_spike_probe',
  ]);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    launchCount: row.launch_count,
    lastBootAt: row.last_boot_at,
    notes: row.notes,
  };
}
