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
    // Should run 1, then 2, then 3
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

    // Run again
    await runMigrations(db, testMigrations);
    expect(executed).toEqual([1]); // No duplicate execution
  });

  it('works from an earlier schema fixture (upgrades from v1 fixture to v2) (Acceptance Criterion)', async () => {
    // 1. Simulate earlier schema fixture at v1
    const v1Migration: Migration = {
      version: 1,
      name: '001_initial_schema',
      async up(conn) {
        await conn.execAsync('CREATE TABLE IF NOT EXISTS save_slots (id TEXT PRIMARY KEY);');
      },
    };

    await runMigrations(db, [v1Migration], 1);
    expect(await getCurrentSchemaVersion(db)).toBe(1);
    expect(db.tables.has('save_slots')).toBe(true);
    expect(db.tables.has('discovered_locations')).toBe(false);

    // 2. Now simulate app update with new v2 migration fixture
    const v2Migration: Migration = {
      version: 2,
      name: '002_add_discovered_locations',
      async up(conn) {
        await conn.execAsync(
          'CREATE TABLE IF NOT EXISTS discovered_locations (id TEXT PRIMARY KEY);'
        );
      },
    };

    const newVersion = await runMigrations(db, [v1Migration, v2Migration]);
    expect(newVersion).toBe(2);
    expect(db.tables.has('save_slots')).toBe(true);
    expect(db.tables.has('discovered_locations')).toBe(true);
  });
});
