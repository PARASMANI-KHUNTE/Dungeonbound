import { validateSaveSnapshot } from '../../game/application/SaveSnapshotValidator';
import { EquipmentSlot, EquipmentState, InventorySlot } from '../../game/domain/items/ItemTypes';
import {
  CURRENT_SAVE_VERSION,
  SaveRepository,
  SaveSnapshot,
  SaveSlotSummary,
} from '../../game/domain/repositories/SaveRepository';
import { Direction } from '../../game/domain/value-objects/Transform';
import { createVector2 } from '../../game/domain/value-objects/Vector2';
import { DatabaseConnection } from './DatabaseConnection';
import { runMigrations } from './migrations/MigrationRunner';

export class SQLiteSaveRepository implements SaveRepository {
  private isInitialized = false;

  constructor(private readonly db: DatabaseConnection) {}

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await runMigrations(this.db);
      this.isInitialized = true;
    }
  }

  async listSlots(): Promise<readonly SaveSlotSummary[]> {
    await this.ensureInitialized();

    const rows = await this.db.getAllAsync<{
      id: string;
      slot_number: number;
      display_name: string;
      play_time_seconds: number;
      created_at: string;
      updated_at: string;
      player_level: number | null;
      map_id: string | null;
    }>(`
      SELECT 
        s.id,
        s.slot_number,
        s.display_name,
        s.play_time_seconds,
        s.created_at,
        s.updated_at,
        p.level AS player_level,
        p.map_id
      FROM save_slots s
      LEFT JOIN player_state p ON s.id = p.slot_id
      ORDER BY s.slot_number ASC;
    `);

    return Object.freeze(
      rows.map((row) => ({
        id: row.id,
        slotNumber: row.slot_number,
        displayName: row.display_name,
        level: row.player_level ?? 1,
        playTimeSeconds: row.play_time_seconds,
        mapId: row.map_id ?? 'village_outskirts',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        hasData: row.player_level !== null,
      }))
    );
  }

  async getSlot(slotId: string): Promise<SaveSlotSummary | null> {
    await this.ensureInitialized();

    const row = await this.db.getFirstAsync<{
      id: string;
      slot_number: number;
      display_name: string;
      play_time_seconds: number;
      created_at: string;
      updated_at: string;
      player_level: number | null;
      map_id: string | null;
    }>(
      `
      SELECT 
        s.id,
        s.slot_number,
        s.display_name,
        s.play_time_seconds,
        s.created_at,
        s.updated_at,
        p.level AS player_level,
        p.map_id
      FROM save_slots s
      LEFT JOIN player_state p ON s.id = p.slot_id
      WHERE s.id = ?;
    `,
      slotId
    );

    if (!row) return null;

    return Object.freeze({
      id: row.id,
      slotNumber: row.slot_number,
      displayName: row.display_name,
      level: row.player_level ?? 1,
      playTimeSeconds: row.play_time_seconds,
      mapId: row.map_id ?? 'village_outskirts',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      hasData: row.player_level !== null,
    });
  }

  async createSlot(slotNumber: number, displayName: string): Promise<SaveSlotSummary> {
    await this.ensureInitialized();
    const id = `slot_${slotNumber}`;
    const now = new Date().toISOString();

    await this.db.runAsync(
      `
      INSERT OR REPLACE INTO save_slots (id, slot_number, display_name, play_time_seconds, created_at, updated_at, save_version)
      VALUES (?, ?, ?, 0, ?, ?, ?);
    `,
      id,
      slotNumber,
      displayName,
      now,
      now,
      CURRENT_SAVE_VERSION
    );

    return Object.freeze({
      id,
      slotNumber,
      displayName,
      level: 1,
      playTimeSeconds: 0,
      mapId: 'village_outskirts',
      createdAt: now,
      updatedAt: now,
      hasData: false,
    });
  }

  async deleteSlot(slotId: string): Promise<void> {
    await this.ensureInitialized();
    await this.db.runAsync('DELETE FROM save_slots WHERE id = ?;', slotId);
  }

  async saveSnapshot(slotId: string, snapshot: SaveSnapshot): Promise<void> {
    await this.ensureInitialized();

    // 1. Validate snapshot before touching the database
    const validation = validateSaveSnapshot(snapshot);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid snapshot: ${validation.errors.join('; ')}`);
    }

    const now = new Date().toISOString();

    // 2. Perform all updates inside an atomic database transaction
    await this.db.withTransactionAsync(async () => {
      // Ensure save slot exists
      await this.db.runAsync(
        `
        INSERT OR IGNORE INTO save_slots (id, slot_number, display_name, play_time_seconds, created_at, updated_at, save_version)
        VALUES (?, 1, 'Hero Save', ?, ?, ?, ?);
      `,
        slotId,
        snapshot.playTimeSeconds,
        now,
        now,
        CURRENT_SAVE_VERSION
      );

      // Update slot metadata
      await this.db.runAsync(
        `
        UPDATE save_slots 
        SET play_time_seconds = ?, updated_at = ?, save_version = ?
        WHERE id = ?;
      `,
        snapshot.playTimeSeconds,
        now,
        CURRENT_SAVE_VERSION,
        slotId
      );

      // Upsert player state
      await this.db.runAsync(
        `
        INSERT OR REPLACE INTO player_state (
          slot_id, level, experience, current_health, max_health, map_id, pos_x, pos_y, facing, currency
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
        slotId,
        snapshot.player.level,
        snapshot.player.experience,
        snapshot.player.currentHealth,
        snapshot.player.maxHealth,
        snapshot.mapId,
        snapshot.player.position.x,
        snapshot.player.position.y,
        snapshot.player.facing,
        0
      );

      // Clear existing inventory items and re-insert current snapshot
      await this.db.runAsync('DELETE FROM inventory_items WHERE slot_id = ?;', slotId);
      for (const slot of snapshot.inventory) {
        if (slot.item) {
          const rowId = `${slotId}_inv_${slot.slotIndex}`;
          await this.db.runAsync(
            `
            INSERT INTO inventory_items (id, slot_id, slot_index, item_id, quantity, instance_id)
            VALUES (?, ?, ?, ?, ?, ?);
          `,
            rowId,
            slotId,
            slot.slotIndex,
            slot.item.itemId,
            slot.item.quantity,
            slot.item.instanceId
          );
        }
      }

      // Clear existing equipped items and re-insert current snapshot
      await this.db.runAsync('DELETE FROM equipped_items WHERE slot_id = ?;', slotId);
      const slots: EquipmentSlot[] = ['weapon', 'head', 'body', 'accessory'];
      for (const slotKey of slots) {
        const item = snapshot.equipment[slotKey];
        if (item) {
          const rowId = `${slotId}_eq_${slotKey}`;
          await this.db.runAsync(
            `
            INSERT INTO equipped_items (id, slot_id, equipment_slot, item_id, instance_id)
            VALUES (?, ?, ?, ?, ?);
          `,
            rowId,
            slotId,
            slotKey,
            item.itemId,
            item.instanceId
          );
        }
      }

      // Clear and re-insert world flags
      await this.db.runAsync('DELETE FROM world_flags WHERE slot_id = ?;', slotId);
      for (const [key, val] of Object.entries(snapshot.worldFlags)) {
        const rowId = `${slotId}_flag_${key}`;
        await this.db.runAsync(
          `
          INSERT INTO world_flags (id, slot_id, flag_key, flag_value)
          VALUES (?, ?, ?, ?);
        `,
          rowId,
          slotId,
          key,
          JSON.stringify(val)
        );
      }

      // Clear and re-insert quest progress
      await this.db.runAsync('DELETE FROM quest_progress WHERE slot_id = ?;', slotId);
      for (const [questId, progress] of Object.entries(snapshot.questState)) {
        const rowId = `${slotId}_quest_${questId}`;
        await this.db.runAsync(
          `
          INSERT INTO quest_progress (id, slot_id, quest_id, status, objective_progress_json)
          VALUES (?, ?, ?, 'active', ?);
        `,
          rowId,
          slotId,
          questId,
          JSON.stringify(progress)
        );
      }
    });
  }

  async loadSnapshot(slotId: string): Promise<SaveSnapshot | null> {
    await this.ensureInitialized();

    const slotRow = await this.db.getFirstAsync<{
      id: string;
      play_time_seconds: number;
      save_version: number;
      updated_at: string;
    }>('SELECT id, play_time_seconds, save_version, updated_at FROM save_slots WHERE id = ?;', slotId);

    if (!slotRow) return null;

    const playerRow = await this.db.getFirstAsync<{
      level: number;
      experience: number;
      current_health: number;
      max_health: number;
      map_id: string;
      pos_x: number;
      pos_y: number;
      facing: string;
    }>('SELECT * FROM player_state WHERE slot_id = ?;', slotId);

    if (!playerRow) return null;

    // Load inventory items
    const inventoryRows = await this.db.getAllAsync<{
      slot_index: number;
      item_id: string;
      quantity: number;
      instance_id: string;
    }>('SELECT slot_index, item_id, quantity, instance_id FROM inventory_items WHERE slot_id = ? ORDER BY slot_index ASC;', slotId);

    const inventory: InventorySlot[] = [];
    const itemMap = new Map<number, { itemId: string; quantity: number; instanceId: string }>();
    for (const r of inventoryRows) {
      itemMap.set(r.slot_index, {
        itemId: r.item_id,
        quantity: r.quantity,
        instanceId: r.instance_id,
      });
    }

    // Standard 20 slots
    for (let i = 0; i < 20; i++) {
      const item = itemMap.get(i);
      inventory.push({
        slotIndex: i,
        item: item ? { instanceId: item.instanceId, itemId: item.itemId, quantity: item.quantity } : null,
      });
    }

    // Load equipped items
    const equippedRows = await this.db.getAllAsync<{
      equipment_slot: EquipmentSlot;
      item_id: string;
      instance_id: string;
    }>('SELECT equipment_slot, item_id, instance_id FROM equipped_items WHERE slot_id = ?;', slotId);

    const equipment: Record<EquipmentSlot, { instanceId: string; itemId: string; quantity: number } | null> = {
      weapon: null,
      head: null,
      body: null,
      accessory: null,
    };

    for (const r of equippedRows) {
      if (r.equipment_slot in equipment) {
        equipment[r.equipment_slot] = {
          instanceId: r.instance_id,
          itemId: r.item_id,
          quantity: 1,
        };
      }
    }

    // Load world flags
    const flagRows = await this.db.getAllAsync<{ flag_key: string; flag_value: string }>(
      'SELECT flag_key, flag_value FROM world_flags WHERE slot_id = ?;',
      slotId
    );
    const worldFlags: Record<string, boolean | number | string> = {};
    for (const f of flagRows) {
      try {
        worldFlags[f.flag_key] = JSON.parse(f.flag_value);
      } catch {
        worldFlags[f.flag_key] = f.flag_value;
      }
    }

    // Load quest progress
    const questRows = await this.db.getAllAsync<{ quest_id: string; objective_progress_json: string }>(
      'SELECT quest_id, objective_progress_json FROM quest_progress WHERE slot_id = ?;',
      slotId
    );
    const questState: Record<string, unknown> = {};
    for (const q of questRows) {
      try {
        questState[q.quest_id] = JSON.parse(q.objective_progress_json);
      } catch {
        questState[q.quest_id] = q.objective_progress_json;
      }
    }

    const snapshot: SaveSnapshot = {
      version: slotRow.save_version,
      slotId,
      playTimeSeconds: slotRow.play_time_seconds,
      mapId: playerRow.map_id,
      player: {
        level: playerRow.level,
        experience: playerRow.experience,
        currentHealth: playerRow.current_health,
        maxHealth: playerRow.max_health,
        position: createVector2(playerRow.pos_x, playerRow.pos_y),
        facing: playerRow.facing as Direction,
      },
      inventory: Object.freeze(inventory),
      equipment: Object.freeze(equipment as EquipmentState),
      worldFlags: Object.freeze(worldFlags),
      questState: Object.freeze(questState),
      timestamp: slotRow.updated_at,
    };

    // 3. Validate loaded snapshot to guard against corrupted saves
    const validation = validateSaveSnapshot(snapshot);
    if (!validation.valid) {
      throw new Error(`Corrupted save data in slot "${slotId}": ${validation.errors.join('; ')}`);
    }

    return Object.freeze(snapshot);
  }
}
