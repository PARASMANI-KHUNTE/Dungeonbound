import { DomainEvent } from '../domain/events/DomainEvents';

/**
 * Placeholder port for combat feedback (visual/audio). The runtime emits
 * combat domain events through this port without depending on a concrete
 * sound engine, so a real audio/particle implementation can be injected later.
 */
export interface CombatFeedback {
  play(event: DomainEvent): void;
}

/** Default feedback used when no presentation layer is wired in. */
export const noopCombatFeedback: CombatFeedback = {
  play: () => undefined,
};

export function isCombatFeedbackEvent(event: DomainEvent): boolean {
  return (
    event.type === 'PLAYER_DAMAGED' ||
    event.type === 'ENEMY_DAMAGED' ||
    event.type === 'ENEMY_DEFEATED' ||
    event.type === 'PLAYER_DIED' ||
    event.type === 'PLAYER_RESPAWNED'
  );
}
