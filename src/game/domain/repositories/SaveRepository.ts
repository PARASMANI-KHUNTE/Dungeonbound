import { EquipmentState, InventorySlot } from '../items/ItemTypes';
import { Direction } from '../value-objects/Transform';
import { Vector2 } from '../value-objects/Vector2';

export const CURRENT_SAVE_VERSION = 1;

export interface SaveSlotSummary {
  readonly id: string;
  readonly slotNumber: number;
  readonly displayName: string;
  readonly level: number;
  readonly playTimeSeconds: number;
  readonly mapId: string;
  readonly updatedAt: string;
  readonly createdAt: string;
  readonly hasData: boolean;
}

export interface PlayerSaveData {
  readonly level: number;
  readonly experience: number;
  readonly currentHealth: number;
  readonly maxHealth: number;
  readonly position: Vector2;
  readonly facing: Direction;
}

export interface SaveSnapshot {
  readonly version: number;
  readonly slotId: string;
  readonly playTimeSeconds: number;
  readonly mapId: string;
  readonly player: PlayerSaveData;
  readonly inventory: readonly InventorySlot[];
  readonly equipment: EquipmentState;
  readonly worldFlags: Record<string, boolean | number | string>;
  readonly questState: Record<string, unknown>;
  readonly timestamp: string;
}

export interface SaveRepository {
  listSlots(): Promise<readonly SaveSlotSummary[]>;
  getSlot(slotId: string): Promise<SaveSlotSummary | null>;
  loadSnapshot(slotId: string): Promise<SaveSnapshot | null>;
  saveSnapshot(slotId: string, snapshot: SaveSnapshot): Promise<void>;
  createSlot(slotNumber: number, displayName: string): Promise<SaveSlotSummary>;
  deleteSlot(slotId: string): Promise<void>;
}
