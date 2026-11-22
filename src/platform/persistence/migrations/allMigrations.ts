import { DatabaseConnection } from '../DatabaseConnection';
import { Migration } from './MigrationTypes';

export const migration001InitialSchema: Migration = {
  version: 1,
  name: '001_initial_schema',
  async up(db: DatabaseConnection): Promise<void> {
    await db.execAsync(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS save_slots (
        id TEXT PRIMARY KEY,
        slot_number INTEGER NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        play_time_seconds INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        save_version INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS player_state (
        slot_id TEXT PRIMARY KEY,
        level INTEGER NOT NULL,
        experience INTEGER NOT NULL,
        current_health INTEGER NOT NULL,
        max_health INTEGER NOT NULL,
        map_id TEXT NOT NULL,
        pos_x REAL NOT NULL,
        pos_y REAL NOT NULL,
        facing TEXT NOT NULL,
        currency INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (slot_id) REFERENCES save_slots (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        slot_id TEXT NOT NULL,
        slot_index INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        instance_id TEXT NOT NULL,
        FOREIGN KEY (slot_id) REFERENCES save_slots (id) ON DELETE CASCADE,
        UNIQUE (slot_id, slot_index)
      );

      CREATE TABLE IF NOT EXISTS equipped_items (
        id TEXT PRIMARY KEY,
        slot_id TEXT NOT NULL,
        equipment_slot TEXT NOT NULL,
        item_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        FOREIGN KEY (slot_id) REFERENCES save_slots (id) ON DELETE CASCADE,
        UNIQUE (slot_id, equipment_slot)
      );

      CREATE TABLE IF NOT EXISTS world_flags (
        id TEXT PRIMARY KEY,
        slot_id TEXT NOT NULL,
        flag_key TEXT NOT NULL,
        flag_value TEXT NOT NULL,
        FOREIGN KEY (slot_id) REFERENCES save_slots (id) ON DELETE CASCADE,
        UNIQUE (slot_id, flag_key)
      );

      CREATE TABLE IF NOT EXISTS quest_progress (
        id TEXT PRIMARY KEY,
        slot_id TEXT NOT NULL,
        quest_id TEXT NOT NULL,
        status TEXT NOT NULL,
        objective_progress_json TEXT NOT NULL,
        FOREIGN KEY (slot_id) REFERENCES save_slots (id) ON DELETE CASCADE,
        UNIQUE (slot_id, quest_id)
      );
    `);
  },
};

export const migration002AddDiscoveredLocations: Migration = {
  version: 2,
  name: '002_add_discovered_locations',
  async up(db: DatabaseConnection): Promise<void> {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS discovered_locations (
        id TEXT PRIMARY KEY,
        slot_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        discovered_at TEXT NOT NULL,
        FOREIGN KEY (slot_id) REFERENCES save_slots (id) ON DELETE CASCADE,
        UNIQUE (slot_id, location_id)
      );
    `);
  },
};

export const ALL_MIGRATIONS: readonly Migration[] = Object.freeze([
  migration001InitialSchema,
  migration002AddDiscoveredLocations,
]);
