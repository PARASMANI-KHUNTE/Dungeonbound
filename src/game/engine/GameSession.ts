import { PlayerEntity } from '../domain/entities/PlayerEntity';
import { Camera } from '../world/Camera';
import { MapDefinition } from '../world/MapDefinition';

export interface GameSession {
  readonly saveSlotId: string;
  readonly map: MapDefinition;
  player: PlayerEntity;
  readonly camera: Camera;
  elapsedTimeSeconds: number;
  isPaused: boolean;
}
