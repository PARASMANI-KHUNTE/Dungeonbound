import { VILLAGE_OUTSKIRTS_MAP } from '../../src/game/content/definitions/maps';
import { GameRuntime } from '../../src/game/engine/GameRuntime';
import { createVector2 } from '../../src/game/domain/value-objects/Vector2';
import { SQLiteSaveRepository } from '../../src/platform/persistence/SQLiteSaveRepository';
import { MockDatabaseConnection } from '../mocks/MockDatabaseConnection';

describe('Phase 5 Persistence Integration (Acceptance Criteria)', () => {
  let db: MockDatabaseConnection;
  let repo: SQLiteSaveRepository;

  beforeEach(() => {
    db = new MockDatabaseConnection();
    repo = new SQLiteSaveRepository(db);
  });

  it('player position, level, XP, HP, inventory, and equipment survive process force-close and relaunch', async () => {
    // 1. Initial boot: Session 1 starts in slot 1
    await repo.createSlot(1, 'Hero Adventure');
    const runtime1 = new GameRuntime('slot_1', VILLAGE_OUTSKIRTS_MAP, 800, 450);

    // Player moves to a new location
    runtime1.setPlayerPositionAndFacing(createVector2(320, 240), 'right');

    // Equip sword from inventory
    const swordIndex = runtime1.currentSession.player.inventory.findIndex(
      (s) => s.item?.itemId === 'rusty_sword'
    );
    expect(swordIndex).toBeGreaterThanOrEqual(0);
    expect(runtime1.equipItem(swordIndex).success).toBe(true);

    // Damage player and drink 1 potion
    runtime1.damagePlayer(40);
    const potionIndex = runtime1.currentSession.player.inventory.findIndex(
      (s) => s.item?.itemId === 'health_potion_small'
    );
    expect(runtime1.useItem(potionIndex).success).toBe(true);

    // Defeat enemy to earn XP
    const enemy = runtime1.currentSession.enemies.get('goblin_1')!;
    runtime1.setPlayerPositionAndFacing(
      createVector2(enemy.transform.position.x - 15, enemy.transform.position.y),
      'right'
    );
    runtime1.triggerPlayerAttack();
    runtime1.fixedUpdate(0.08); // strike enemy

    // Capture state before shutdown
    const preShutdownLevel = runtime1.currentSession.player.level;
    const preShutdownXp = runtime1.currentSession.player.experience;
    const preShutdownHp = runtime1.currentSession.player.currentHealth;
    const preShutdownPos = runtime1.currentSession.player.transform.position;
    const preShutdownEquip = runtime1.currentSession.player.equipment.weapon?.itemId;

    // Save snapshot to repository
    const snapshotToSave = runtime1.createSaveSnapshot();
    await repo.saveSnapshot('slot_1', snapshotToSave);

    // 2. SIMULATE FORCE-CLOSE: Dispose session 1 completely
    runtime1.dispose();

    // 3. RELAUNCH: Boot a completely fresh GameRuntime instance for slot_1
    const runtime2 = new GameRuntime('slot_1', VILLAGE_OUTSKIRTS_MAP, 800, 450);

    // Load saved snapshot from durable repository
    const loadedSnapshot = await repo.loadSnapshot('slot_1');
    expect(loadedSnapshot).not.toBeNull();

    // Hydrate game session from loaded snapshot
    runtime2.loadFromSnapshot(loadedSnapshot!);

    // 4. VERIFY: State survived completely intact!
    expect(runtime2.currentSession.player.level).toBe(preShutdownLevel);
    expect(runtime2.currentSession.player.experience).toBe(preShutdownXp);
    expect(runtime2.currentSession.player.currentHealth).toBe(preShutdownHp);
    expect(runtime2.currentSession.player.transform.position.x).toBe(preShutdownPos.x);
    expect(runtime2.currentSession.player.transform.position.y).toBe(preShutdownPos.y);
    expect(runtime2.currentSession.player.equipment.weapon?.itemId).toBe(preShutdownEquip);

    // Verify inventory state survived with decremented potion
    const potionSlot = runtime2.currentSession.player.inventory[potionIndex];
    expect(potionSlot.item?.quantity).toBe(1);

    runtime2.dispose();
  });
});
