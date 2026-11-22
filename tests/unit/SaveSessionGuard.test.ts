import { SaveSessionGuard } from '../../src/game/application/SaveSessionGuard';
import { SaveSnapshot } from '../../src/game/domain/repositories/SaveRepository';
import { createVector2 } from '../../src/game/domain/value-objects/Vector2';

describe('SaveSessionGuard (corrupt-save handling)', () => {
  const validSnapshot: SaveSnapshot = {
    version: 1,
    slotId: 'slot_1',
    playTimeSeconds: 10,
    mapId: 'village_outskirts',
    player: {
      level: 1,
      experience: 0,
      currentHealth: 100,
      maxHealth: 100,
      position: createVector2(160, 200),
      facing: 'down',
    },
    inventory: [],
    equipment: { weapon: null, head: null, body: null, accessory: null },
    worldFlags: {},
    questState: {},
    timestamp: '2026-11-22T12:00:00.000Z',
  };

  function createRepo(loadImpl: () => Promise<SaveSnapshot | null>) {
    return {
      loadSnapshot: jest.fn(loadImpl),
      saveSnapshot: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('allows saves after a successful load', async () => {
    const repo = createRepo(async () => validSnapshot);
    const guard = new SaveSessionGuard(repo, 'slot_1');
    const apply = jest.fn();

    expect(await guard.load(apply)).toEqual({ ok: true });
    expect(apply).toHaveBeenCalledWith(validSnapshot);

    const saveResult = await guard.save(() => validSnapshot);
    expect(saveResult).toEqual({ ok: true });
    expect(repo.saveSnapshot).toHaveBeenCalledWith('slot_1', validSnapshot);
    expect(guard.isSaveBlocked).toBe(false);
  });

  it('does not overwrite a save that failed validation on load', async () => {
    const repo = createRepo(async () => {
      throw new Error('Corrupted save data in slot "slot_1"');
    });
    const guard = new SaveSessionGuard(repo, 'slot_1');

    const loadResult = await guard.load(jest.fn());

    expect(loadResult.ok).toBe(false);
    expect(loadResult.error).toContain('Corrupted save data');
    expect(guard.isSaveBlocked).toBe(true);

    const saveResult = await guard.save(() => validSnapshot);
    expect(saveResult.ok).toBe(false);
    expect(saveResult.error).toContain('Save blocked');
    expect(repo.saveSnapshot).not.toHaveBeenCalled();
    expect(repo.loadSnapshot).toHaveBeenCalledTimes(1);
  });

  it('unblocks saves only after an explicit new-game action', async () => {
    const repo = createRepo(async () => {
      throw new Error('Corrupted save data');
    });
    const guard = new SaveSessionGuard(repo, 'slot_1');
    await guard.load(jest.fn());

    guard.allowNewGame();

    expect(guard.isSaveBlocked).toBe(false);
    expect(await guard.save(() => validSnapshot)).toEqual({ ok: true });
    expect(repo.saveSnapshot).toHaveBeenCalledTimes(1);
  });

  it('permits a fresh save when the slot has no existing data', async () => {
    const repo = createRepo(async () => null);
    const guard = new SaveSessionGuard(repo, 'slot_1');
    const apply = jest.fn();

    expect(await guard.load(apply)).toEqual({ ok: true });
    expect(apply).not.toHaveBeenCalled();
    expect(await guard.save(() => validSnapshot)).toEqual({ ok: true });
  });
});
