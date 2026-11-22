import { DatabaseConnection, RunResult } from '../../src/platform/persistence/DatabaseConnection';

interface TableRow {
  [column: string]: any;
}

export class MockDatabaseConnection implements DatabaseConnection {
  public tables: Map<string, TableRow[]> = new Map();
  public failNextRun = false;
  public failNextTransaction = false;

  private cloneState(): Map<string, TableRow[]> {
    const copy = new Map<string, TableRow[]>();
    for (const [name, rows] of this.tables.entries()) {
      copy.set(
        name,
        rows.map((r) => ({ ...r }))
      );
    }
    return copy;
  }

  private restoreState(savedState: Map<string, TableRow[]>): void {
    this.tables = savedState;
  }

  async execAsync(sql: string): Promise<void> {
    // Basic table creation parser for known tables
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      const match = stmt.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
      if (match) {
        const tableName = match[1];
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
      }
    }
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<RunResult> {
    if (this.failNextRun) {
      this.failNextRun = false;
      throw new Error('Simulated SQLite run error');
    }

    const trimmed = sql.trim();

    // 1. INSERT OR REPLACE / INSERT OR IGNORE / INSERT
    const insertMatch = trimmed.match(
      /INSERT(?:\s+OR\s+(?:REPLACE|IGNORE))?\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i
    );
    if (insertMatch) {
      const tableName = insertMatch[1];
      const cols = insertMatch[2].split(',').map((c) => c.trim());
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
      const table = this.tables.get(tableName)!;

      const row: TableRow = {};
      cols.forEach((col, idx) => {
        row[col] = params[idx];
      });

      const isReplace = /INSERT\s+OR\s+REPLACE/i.test(trimmed);
      const isIgnore = /INSERT\s+OR\s+IGNORE/i.test(trimmed);

      // Check unique / primary key collision on 'id' or 'slot_number' or compound
      const pkIndex = table.findIndex(
        (r) =>
          (row.id !== undefined && r.id === row.id) ||
          (row.slot_id !== undefined &&
            row.slot_index !== undefined &&
            r.slot_id === row.slot_id &&
            r.slot_index === row.slot_index) ||
          (row.slot_id !== undefined &&
            row.equipment_slot !== undefined &&
            r.slot_id === row.slot_id &&
            r.equipment_slot === row.equipment_slot) ||
          (row.slot_id !== undefined &&
            row.flag_key !== undefined &&
            r.slot_id === row.slot_id &&
            r.flag_key === row.flag_key) ||
          (row.slot_id !== undefined &&
            row.quest_id !== undefined &&
            r.slot_id === row.slot_id &&
            r.quest_id === row.quest_id)
      );

      if (pkIndex !== -1) {
        if (isReplace) {
          table[pkIndex] = row;
        } else if (isIgnore) {
          return { changes: 0, lastInsertRowId: 0 };
        } else {
          throw new Error(`UNIQUE constraint failed: ${tableName}`);
        }
      } else {
        table.push(row);
      }

      return { changes: 1, lastInsertRowId: table.length };
    }

    // 2. UPDATE
    const updateMatch = trimmed.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
    if (updateMatch) {
      const tableName = updateMatch[1];
      const setClause = updateMatch[2];
      const table = this.tables.get(tableName) ?? [];

      const setAssignments = setClause.split(',').map((s) => s.trim().split('=')[0].trim());
      // Last param is WHERE clause value
      const whereVal = params[params.length - 1];

      let changes = 0;
      for (const row of table) {
        if (row.id === whereVal || row.slot_id === whereVal) {
          setAssignments.forEach((col, idx) => {
            row[col] = params[idx];
          });
          changes++;
        }
      }
      return { changes, lastInsertRowId: 0 };
    }

    // 3. DELETE
    const deleteMatch = trimmed.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i);
    if (deleteMatch) {
      const tableName = deleteMatch[1];
      const whereClause = deleteMatch[2];
      const table = this.tables.get(tableName) ?? [];

      if (!whereClause) {
        const changes = table.length;
        this.tables.set(tableName, []);
        return { changes, lastInsertRowId: 0 };
      }

      const whereCol = whereClause.split('=')[0].trim();
      const whereVal = params[0];

      const remaining = table.filter((r) => r[whereCol] !== whereVal);
      const changes = table.length - remaining.length;
      this.tables.set(tableName, remaining);

      // Cascading delete simulation for save_slots -> player_state, inventory, etc.
      if (tableName === 'save_slots' && whereCol === 'id') {
        for (const childTable of [
          'player_state',
          'inventory_items',
          'equipped_items',
          'world_flags',
          'quest_progress',
        ]) {
          const childRows = this.tables.get(childTable) ?? [];
          this.tables.set(
            childTable,
            childRows.filter((r) => r.slot_id !== whereVal)
          );
        }
      }

      return { changes, lastInsertRowId: 0 };
    }

    return { changes: 0, lastInsertRowId: 0 };
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const all = await this.getAllAsync<T>(sql, ...params);
    return all.length > 0 ? all[0] : null;
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const trimmed = sql.trim();

    // SELECT MAX(version) FROM schema_migrations
    if (/SELECT\s+MAX\(version\)\s+AS\s+max_version\s+FROM\s+schema_migrations/i.test(trimmed)) {
      const table = this.tables.get('schema_migrations') ?? [];
      const versions = table.map((r) => r.version as number);
      const max_version = versions.length > 0 ? Math.max(...versions) : null;
      return [{ max_version }] as unknown as T[];
    }

    // SELECT version FROM schema_migrations
    if (/SELECT\s+version\s+FROM\s+schema_migrations/i.test(trimmed)) {
      const table = this.tables.get('schema_migrations') ?? [];
      return table.map((r) => ({ version: r.version })) as unknown as T[];
    }

    // SELECT save_slots with left join
    if (/FROM\s+save_slots\s+s\s+LEFT\s+JOIN\s+player_state\s+p/i.test(trimmed)) {
      const slots = this.tables.get('save_slots') ?? [];
      const players = this.tables.get('player_state') ?? [];

      const isWhere = /WHERE\s+s\.id\s*=\s*\?/i.test(trimmed);
      const targetId = isWhere ? params[0] : null;

      const filteredSlots = targetId ? slots.filter((s) => s.id === targetId) : slots;

      return filteredSlots.map((s) => {
        const p = players.find((pl) => pl.slot_id === s.id);
        return {
          id: s.id,
          slot_number: s.slot_number,
          display_name: s.display_name,
          play_time_seconds: s.play_time_seconds,
          created_at: s.created_at,
          updated_at: s.updated_at,
          player_level: p ? p.level : null,
          map_id: p ? p.map_id : null,
        };
      }) as unknown as T[];
    }

    // Generic SELECT FROM <table> WHERE <col> = ?
    const genericMatch = trimmed.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY.+)?$/i);
    if (genericMatch) {
      const tableName = genericMatch[2];
      const whereClause = genericMatch[3];
      const table = this.tables.get(tableName) ?? [];

      if (!whereClause) {
        return table.map((r) => ({ ...r })) as unknown as T[];
      }

      const colMatch = whereClause.match(/(\w+)\s*=\s*\?/);
      if (colMatch) {
        const col = colMatch[1];
        const val = params[0];
        const rows = table.filter((r) => r[col] === val);
        return rows.map((r) => ({ ...r })) as unknown as T[];
      }
    }

    return [];
  }

  async withTransactionAsync<T>(action: () => Promise<T>): Promise<T> {
    if (this.failNextTransaction) {
      this.failNextTransaction = false;
      throw new Error('Simulated transaction setup failure');
    }

    // Snapshot state for atomic rollback
    const backupState = this.cloneState();

    try {
      const result = await action();
      return result;
    } catch (err) {
      // Rollback to backup state on error!
      this.restoreState(backupState);
      throw err;
    }
  }
}
