import { DatabaseConnection } from '../DatabaseConnection';
import { ALL_MIGRATIONS } from './allMigrations';
import { Migration } from './MigrationTypes';

export async function initMigrationTable(db: DatabaseConnection): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL,
      name TEXT NOT NULL
    );
  `);

  // Older app versions created this table without the `name` column. CREATE
  // TABLE IF NOT EXISTS is a no-op for those installs, so heal the legacy
  // schema before the INSERT below can reference a missing column.
  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(schema_migrations);'
  );
  if (!columns.some((column) => column.name === 'name')) {
    await db.execAsync("ALTER TABLE schema_migrations ADD COLUMN name TEXT NOT NULL DEFAULT '';");
  }
}

export async function getCurrentSchemaVersion(db: DatabaseConnection): Promise<number> {
  await initMigrationTable(db);
  const row = await db.getFirstAsync<{ max_version: number | null }>(
    'SELECT MAX(version) AS max_version FROM schema_migrations;'
  );
  return row?.max_version ?? 0;
}

export async function getAppliedMigrationVersions(db: DatabaseConnection): Promise<Set<number>> {
  await initMigrationTable(db);
  const rows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC;'
  );
  return new Set(rows.map((r) => r.version));
}

export async function runMigrations(
  db: DatabaseConnection,
  migrations: readonly Migration[] = ALL_MIGRATIONS,
  targetVersion?: number
): Promise<number> {
  await initMigrationTable(db);
  const applied = await getAppliedMigrationVersions(db);

  const pending = migrations
    .filter((m) => !applied.has(m.version))
    .filter((m) => (targetVersion !== undefined ? m.version <= targetVersion : true))
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at, name) VALUES (?, ?, ?);',
        migration.version,
        new Date().toISOString(),
        migration.name
      );
    });
  }

  return getCurrentSchemaVersion(db);
}
