import { Vector2 } from '../value-objects/Vector2';

export interface PickupEntity {
  readonly id: string;
  readonly itemId: string;
  readonly quantity: number;
  readonly position: Vector2;
  readonly pickupRadius: number; // world pixels, default 24
  readonly createdAtMs: number;
}

export function createPickupEntity(
  id: string,
  itemId: string,
  position: Vector2,
  quantity = 1,
  pickupRadius = 24,
  createdAtMs = 0
): PickupEntity {
  return Object.freeze({
    id,
    itemId,
    quantity,
    position: Object.freeze({ ...position }),
    pickupRadius,
    createdAtMs,
  });
}
