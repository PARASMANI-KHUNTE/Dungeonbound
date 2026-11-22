import { SaveSnapshot } from '../../src/game/domain/repositories/SaveRepository';
import { createVector2 } from '../../src/game/domain/value-objects/Vector2';
import { SQLiteSaveRepository } from '../../src/platform/persistence/SQLiteSaveRepository';
import { MockDatabaseConnection } from '../mocks/MockDatabaseConnection';

describe('SQLiteSaveRepository (Acceptance Criteria)', () => {
  let db: MockDatabaseConnection;
  let repo: SQLiteSaveRepository;

  const validSnapshotV1: SaveSnapshot = {
    version: 1,
    slotId: 'slot_1',
    playTimeSeconds: 45,
    mapId: 'village_outskirts',
    player: {
      level: 2,
      experience: 60,
      currentHealth: 112,
      maxHealth: 112,
      position: createVector2(150, 220),
      facing: 'down',
    },
    inventory: [
      {
        slotIndex: 0,
        item: { instanceId: 'p1', itemId: 'health_potion_small', quantity: 2 },
      },
      {
        slotIndex: 1,
        item: { instanceId: 's1', itemId: 'rusty_sword', quantity: 1 },
      },
    ],
    equipment: {
      weapon: { instanceId: 's1', itemId: 'rusty_sword', quantity: 1 },
      head: null,
      body: null,
      accessory: null,
    },
    worldFlags: { boss_slain: false, goblins_slain: 3, region: 'village' },
    questState: { main_quest: { status: 'active', progress: 2 } },
    timestamp: '2026-11-22T12:00:00.000Z',
  };

  beforeEach(() => {
    db = new MockDatabaseConnection();
    repo = new SQLiteSaveRepository(db);
  });

  describe('Slot Management', () => {
    it('creates, lists, and retrieves save slots', async () => {
      await repo.createSlot(1, 'Warrior Run');
      await repo.createSlot(2, 'Mage Run');

      const slots = await repo.listSlots();
      expect(slots.length).toBe(2);
      expect(slots[0].slotNumber).toBe(1);
      expect(slots[0].displayName).toBe('Warrior Run');
      expect(slots[0].hasData).toBe(false);

      const slot1 = await repo.getSlot('slot_1');
      expect(slot1).toBeDefined();
      expect(slot1?.displayName).toBe('Warrior Run');
    });

    it('deletes slot and cascades deletion to child records', async () => {
      await repo.createSlot(1, 'Hero');
      await repo.saveSnapshot('slot_1', validSnapshotV1);

      expect(await repo.loadSnapshot('slot_1')).not.toBeNull();

      await repo.deleteSlot('slot_1');

      expect(await repo.getSlot('slot_1')).toBeNull();
      expect(await repo.loadSnapshot('slot_1')).toBeNull();
    });
  });

  describe('Save and Load Snapshot', () => {
    it('saves snapshot and loads identical state back', async () => {
      await repo.createSlot(1, 'Hero Run');
      await repo.saveSnapshot('slot_1', validSnapshotV1);

      const loaded = await repo.loadSnapshot('slot_1');
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(1);
      expect(loaded?.player.level).toBe(2);
      expect(loaded?.player.experience).toBe(60);
      expect(loaded?.player.position.x).toBe(150);
      expect(loaded?.player.position.y).toBe(220);
      expect(loaded?.equipment.weapon?.itemId).toBe('rusty_sword');
      expect(loaded?.worldFlags).toEqual(validSnapshotV1.worldFlags);
      expect(loaded?.questState).toEqual(validSnapshotV1.questState);

      const slots = await repo.listSlots();
      expect(slots[0].hasData).toBe(true);
      expect(slots[0].level).toBe(2);
    });

    it('rejects saving invalid/corrupted snapshots upfront', async () => {
      const corruptSnapshot = {
        ...validSnapshotV1,
        player: {
          ...validSnapshotV1.player,
          level: -1, // Invalid level
        },
      };

      await expect(repo.saveSnapshot('slot_1', corruptSnapshot)).rejects.toThrow(
        'Cannot save invalid snapshot'
      );
    });

    it('guarantees atomic transaction rollback on failure (Acceptance Criterion)', async () => {
      // 1. Save valid initial state
      await repo.createSlot(1, 'Initial Hero');
      await repo.saveSnapshot('slot_1', validSnapshotV1);

      const initialLoaded = await repo.loadSnapshot('slot_1');
      expect(initialLoaded?.player.level).toBe(2);

      // 2. Prepare new snapshot with level 5 and a changed inventory stack.
      const newSnapshot: SaveSnapshot = {
        ...validSnapshotV1,
        player: {
          ...validSnapshotV1.player,
          level: 5,
          currentHealth: 148,
          maxHealth: 148,
        },
        inventory: [
          {
            slotIndex: 0,
            item: { instanceId: 'p1', itemId: 'health_potion_small', quantity: 9 },
          },
        ],
      };

      // 3. Fail in the middle of the transaction, AFTER the slot metadata,
      //    player row, and old inventory rows have already been written.
      db.failRunOnSqlPattern = /INSERT\s+INTO inventory_items/i;

      await expect(repo.saveSnapshot('slot_1', newSnapshot)).rejects.toThrow(
        'Simulated SQLite run error'
      );

      // 4. Verify all earlier writes were rolled back, not just skipped.
      const afterRollback = await repo.loadSnapshot('slot_1');
      expect(afterRollback?.player.level).toBe(2);
      expect(afterRollback?.player.currentHealth).toBe(112);
      expect(afterRollback?.inventory[0].item?.quantity).toBe(2);
      expect(afterRollback?.inventory).toHaveLength(20);

      const rawPlayerRows = db.tables.get('player_state') ?? [];
      expect(rawPlayerRows).toHaveLength(1);
      expect(rawPlayerRows[0].level).toBe(2);
      const rawInventoryRows = db.tables.get('inventory_items') ?? [];
      expect(rawInventoryRows).toHaveLength(2);
    });
  });
});
