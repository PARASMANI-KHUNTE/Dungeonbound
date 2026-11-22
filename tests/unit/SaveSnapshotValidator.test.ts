import { validateSaveSnapshot } from '../../src/game/application/SaveSnapshotValidator';
import { SaveSnapshot } from '../../src/game/domain/repositories/SaveRepository';
import { createVector2 } from '../../src/game/domain/value-objects/Vector2';

describe('SaveSnapshotValidator (Acceptance Criteria)', () => {
  const validSnapshot: SaveSnapshot = {
    version: 1,
    slotId: 'slot_1',
    playTimeSeconds: 120,
    mapId: 'village_outskirts',
    player: {
      level: 3,
      experience: 150,
      currentHealth: 85,
      maxHealth: 124,
      position: createVector2(200, 300),
      facing: 'down',
    },
    inventory: [
      {
        slotIndex: 0,
        item: { instanceId: 'inst_1', itemId: 'health_potion_small', quantity: 3 },
      },
      {
        slotIndex: 1,
        item: { instanceId: 'inst_2', itemId: 'rusty_sword', quantity: 1 },
      },
    ],
    equipment: {
      weapon: { instanceId: 'inst_2', itemId: 'rusty_sword', quantity: 1 },
      head: null,
      body: null,
      accessory: null,
    },
    worldFlags: { tutorial_done: true, goblins_slain: 3 },
    questState: {},
    timestamp: '2026-11-22T12:00:00.000Z',
  };

  it('validates a well-formed snapshot successfully', () => {
    const res = validateSaveSnapshot(validSnapshot);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('rejects unsupported future versions', () => {
    const badVer = { ...validSnapshot, version: 999 };
    const res = validateSaveSnapshot(badVer);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Unsupported save version'))).toBe(true);
  });

  it('rejects negative or impossible player attributes (currentHealth > maxHealth, level 0)', () => {
    const badHp = {
      ...validSnapshot,
      player: {
        ...validSnapshot.player,
        level: 0,
        currentHealth: 200,
        maxHealth: 100,
      },
    };
    const res = validateSaveSnapshot(badHp);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('cannot exceed maxHealth'))).toBe(true);
    expect(res.errors.some((e) => e.includes('Invalid player level'))).toBe(true);
  });

  it('rejects invalid facing directions', () => {
    const badFacing = {
      ...validSnapshot,
      player: {
        ...validSnapshot.player,
        facing: 'diagonal_northwest' as any,
      },
    };
    const res = validateSaveSnapshot(badFacing);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Invalid player facing direction'))).toBe(true);
  });

  it('rejects unknown item references in inventory', () => {
    const badItem = {
      ...validSnapshot,
      inventory: [
        {
          slotIndex: 0,
          item: { instanceId: 'x', itemId: 'unobtainable_laser_rifle', quantity: 1 },
        },
      ],
    };
    const res = validateSaveSnapshot(badItem);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('unknown itemId'))).toBe(true);
  });

  it('rejects equipment in invalid slots (e.g. sword in head slot)', () => {
    const badEquip = {
      ...validSnapshot,
      equipment: {
        ...validSnapshot.equipment,
        head: { instanceId: 'h1', itemId: 'rusty_sword', quantity: 1 }, // sword is weapon, not head!
      },
    };
    const res = validateSaveSnapshot(badEquip);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('cannot be equipped in "head"'))).toBe(true);
  });

  it('rejects malformed world flags and quest state', () => {
    const badFlags = {
      ...validSnapshot,
      worldFlags: { nested: { unexpected: true } },
      questState: [],
    };
    const res = validateSaveSnapshot(badFlags);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('unsupported value'))).toBe(true);
    expect(res.errors.some((e) => e.includes('questState must be a plain object'))).toBe(true);
  });
});
