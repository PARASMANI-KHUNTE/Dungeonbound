import {
  ALL_MIGRATIONS,
  migration002AddDiscoveredLocations,
} from '../../src/platform/persistence/migrations/allMigrations';
import { Migration } from '../../src/platform/persistence/migrations/MigrationTypes';
import {
  getCurrentSchemaVersion,
  runMigrations,
} from '../../src/platform/persistence/migrations/MigrationRunner';
import { MockDatabaseConnection } from '../mocks/MockDatabaseConnection';

describe('MigrationRunner (Acceptance Criteria)', () => {
  let db: MockDatabaseConnection;

  beforeEach(() => {
    db = new MockDatabaseConnection();
  });

  it('runs migrations in sequential version order and records them in schema_migrations', async () => {
    const executed: number[] = [];

    const testMigrations: Migration[] = [
      {
        version: 2,
        name: '002_second',
        async up() {
          executed.push(2);
        },
      },
      {
        version: 1,
        name: '001_first',
        async up() {
          executed.push(1);
        },
      },
      {
        version: 3,
        name: '003_third',
        async up() {
          executed.push(3);
        },
      },
    ];

    const finalVer = await runMigrations(db, testMigrations);
    expect(finalVer).toBe(3);
    expect(executed).toEqual([1, 2, 3]);

    const currentVer = await getCurrentSchemaVersion(db);
    expect(currentVer).toBe(3);
  });

  it('is idempotent: running migrations again does not re-execute applied migrations', async () => {
    const executed: number[] = [];
    const testMigrations: Migration[] = [
      {
        version: 1,
        name: '001_initial',
        async up() {
          executed.push(1);
        },
      },
    ];

    await runMigrations(db, testMigrations);
    expect(executed).toEqual([1]);

    await runMigrations(db, testMigrations);
    expect(executed).toEqual([1]);
  });

  it('creates the complete real schema on a clean install', async () => {
    const version = await runMigrations(db);

    expect(version).toBe(2);
    expect([...db.tables.keys()].sort()).toEqual(
      [
        'schema_migrations',
        'save_slots',
        'player_state',
        'inventory_items',
        'equipped_items',
        'world_flags',
        'quest_progress',
        'discovered_locations',
      ].sort()
    );
  });

  it('upgrades from the real v1 fixture to v2 (Acceptance Criterion)', async () => {
    // 1. Earlier app version: only migration 001 has been applied.
    const v1 = await runMigrations(db, ALL_MIGRATIONS, 1);
    expect(v1).toBe(1);
    expect(db.tables.has('save_slots')).toBe(true);
    expect(db.tables.has('world_flags')).toBe(true);
    expect(db.tables.has('quest_progress')).toBe(true);
    expect(db.tables.has('discovered_locations')).toBe(false);

    // 2. Later app version: migration 002 is applied without re-running 001.
    const v2 = await runMigrations(db, ALL_MIGRATIONS);
    expect(v2).toBe(2);
    expect(db.tables.has('discovered_locations')).toBe(true);
    expect(migration002AddDiscoveredLocations.version).toBe(2);

    const applied = await db.getAllAsync<{ version: number; name: string }>(
      'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
    );
    expect(applied).toEqual([
      { version: 1, name: '001_initial_schema' },
      { version: 2, name: '002_add_discovered_locations' },
    ]);
  });

  it('heals a legacy schema_migrations table created without the name column', async () => {
    await db.execAsync(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);'
    );
    expect(db.tableColumns.get('schema_migrations')).not.toContain('name');

    const version = await runMigrations(db, [
      {
        version: 1,
        name: '001_legacy_repair',
        async up(conn) {
          await conn.execAsync('CREATE TABLE IF NOT EXISTS legacy_table (id TEXT PRIMARY KEY);');
        },
      },
    ]);

    expect(version).toBe(1);
    expect(db.tableColumns.get('schema_migrations')).toContain('name');
    const rows = await db.getAllAsync<{ version: number; name: string }>(
      'SELECT version, name FROM schema_migrations;'
    );
    expect(rows).toEqual([{ version: 1, name: '001_legacy_repair' }]);
  });
});
