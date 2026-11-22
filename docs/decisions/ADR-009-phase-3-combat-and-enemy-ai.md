# ADR-009: Phase 3 Combat and Enemy AI

## Status
Accepted

## Context
Following Phase 1, Dungeonbound requires establishing the core action-RPG interaction: real-time melee combat, attack state machines, world-space directional hitboxes, damage formulas with defense reduction, knockback, invulnerability frames (i-frames), enemy AI finite state machines, player death, and respawn.

## Decisions

1. **Attack State Machine & Hitbox Timing**:
   - Attacks are modeled with explicit phases: `startupMs`, `activeMs`, and `recoveryMs`.
   - Hitboxes are calculated in world coordinates based on the attacker's position and facing direction (`up`, `down`, `left`, `right`).
   - Hits are processed exactly once per target per attack instance during the active hit window.

2. **Damage, Knockback, and I-Frames**:
   - Damage formula: $\max(1, \lfloor \text{attackPower} \times \text{multiplier} - \text{defense} \times 0.5 \rfloor)$.
   - Hits apply directional knockback pushing defenders away from attackers.
   - Temporary invulnerability (i-frames: $280\text{ms}$ for enemies, $400\text{ms}$ for player) prevents multi-hit damage within a single attack stroke.

3. **Enemy AI Finite State Machine**:
   - Pure state machine with states: `idle`, `chase`, `attack`, `hurt`, `dead`.
   - `idle`: Remains in place when player is beyond aggro radius.
   - `chase`: Moves towards player when within aggro radius ($180\text{ units}$).
   - `attack`: Triggers attack when in attack range ($34\text{ units}$) and cooldown is ready.
   - `hurt`: Locks movement during hit reaction ($220\text{ms}$).
   - `dead`: Invariant: dead enemies never move, attack, or trigger hits.

4. **Domain Events**:
   - Domain systems emit `PLAYER_DAMAGED`, `ENEMY_DAMAGED`, `ENEMY_DEFEATED`, `PLAYER_DIED`, and `PLAYER_RESPAWNED` events without coupling to UI components.

5. **Collision Integration**:
   - Player and enemy movement is validated against `CollisionGrid` (e.g. water and stone borders) with wall-sliding response.

6. **UI & Death Handling**:
   - Touch controls include a dedicated attack button.
   - Player death pauses normal simulation updates and displays a Game Over modal with "Respawn at Village", which teleports the player to the safe spawn point and restores health.
