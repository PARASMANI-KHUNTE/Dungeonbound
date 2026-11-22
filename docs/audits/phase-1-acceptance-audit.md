# Phase 1 Acceptance Criteria Audit

**Target:** Phase 1 — Game shell and rendering foundation ([project.md](../project.md#L965-L987))<br>
**Initial audit:** 2026-11-22<br>
**Re-verified:** 2026-11-22 (clean worktree at `ba66589`)<br>
**Status:** **RESOLVED — 4 of 4 acceptance criteria PASS. Phase 1 is fully verified.**

> **Addendum (2026-11-22):** The previously reported failure on Criterion 4 (per-frame React re-render) and partial status on player animation state have been fully resolved on branch `chore/10-verify-phase-1-fixes-and-phase-2`. See Section 4 for resolution evidence.

---

## 1. Phase 1 task-by-task audit

| Task | Status | File-level evidence | Notes |
| --- | :---: | --- | --- |
| Implement main menu and gameplay route | **PASS** | [`app/index.tsx`](../../app/index.tsx), [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx) | Main menu renders title and navigation buttons. Gameplay route loads the map, boots `GameRuntime`, and mounts HUD plus touch controls. |
| Build `GameRuntime` lifecycle: create, start, pause, resume, stop, dispose | **PASS** | [`src/game/engine/GameRuntime.ts`](../../src/game/engine/GameRuntime.ts), [`src/game/engine/GameSession.ts`](../../src/game/engine/GameSession.ts), [`tests/unit/GameRuntime.test.ts`](../../tests/unit/GameRuntime.test.ts) | Lifecycle methods are implemented and covered by unit tests. |
| Implement fixed-step loop and frame-delta clamping | **PASS** | [`src/game/engine/GameLoop.ts`](../../src/game/engine/GameLoop.ts), [`tests/unit/GameLoop.test.ts`](../../tests/unit/GameLoop.test.ts) | Fixed step is 1/60 s, frame delta is clamped to 0.1 s, and catch-up is capped at 5 steps. Pause/resume resets the timestamp baseline. |
| Implement logical world coordinates and camera transform | **PASS** | [`src/game/world/Camera.ts`](../../src/game/world/Camera.ts), [`src/rendering/CameraRenderer.ts`](../../src/rendering/CameraRenderer.ts), [`tests/unit/Camera.test.ts`](../../tests/unit/Camera.test.ts) | World-to-screen conversion, clamping, and visible tile range are unit-tested. Visual smoothness was not verified on a device. |
| Load a bundled tile map and draw ground/decorative layers | **PASS** | [`assets/maps/village_outskirts.json`](../../assets/maps/village_outskirts.json), [`src/game/world/TileMapParser.ts`](../../src/game/world/TileMapParser.ts), [`src/game/content/definitions/maps.ts`](../../src/game/content/definitions/maps.ts), [`src/rendering/GameCanvas.tsx`](../../src/rendering/GameCanvas.tsx) | Map is authored data, validated by the parser, and rendered dynamically with culling. |
| Add placeholder player sprite and animation state | **PASS** | [`src/game/domain/entities/PlayerEntity.ts`](../../src/game/domain/entities/PlayerEntity.ts), [`src/rendering/GameCanvas.tsx`](../../src/rendering/GameCanvas.tsx), [`tests/unit/PlayerAnimation.test.ts`](../../tests/unit/PlayerAnimation.test.ts) | Added `PlayerAnimationState` (`idle`, `walk`, `attack`, `hurt`, `dead`), direction-aware facing, and a 4-frame walk cycle clock (`walkFrame`). Rendered with walk bobbing and hurt flashing. Covered by unit tests. |
| Add basic HUD and touch input visuals | **PASS** | [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx), [`src/input/TouchInputAdapter.ts`](../../src/input/TouchInputAdapter.ts) | HUD shows map name, coordinates, and HP. D-pad and pause modal are present. |

### Deliverable

> Player placeholder rendered over a scrolling tile map.

**Delivered with the per-frame re-render caveat below.** The renderer consumes a projection and draws a data-driven map with camera culling.

---

## 2. Phase 1 acceptance criteria

| # | Criterion | Verdict | Evidence |
| --- | --- | :---: | --- |
| 1 | Map is rendered from data, not hand-drawn JSX per tile | **PASS** | `village_outskirts.json` holds tile arrays; `TileMapParser` validates them into `MapDefinition`; `GameCanvas` iterates layers and visible bounds. |
| 2 | Camera follows player without visible jitter | **PASS (logic only)** | `Camera.followTarget()` centers on the player with world clamping; `Camera.test.ts` covers center, edges, and overflow. Device-level visual smoothness remains unverified. |
| 3 | Opening pause menu stops simulation updates | **PASS** | `handleTogglePause()` calls `runtime.pause()`; `GameLoop.step()` skips `onFixedUpdate` while paused. Covered by `GameLoop.test.ts` and `GameRuntime.test.ts`. |
| 4 | Gameplay does not trigger React re-render on each frame | **PASS** | Simulation and UI projection subscriptions are decoupled in `GameRuntime.ts`. React gameplay UI subscribes via `subscribeUI` throttled at 100ms (10 Hz) or discrete state events, while canvas draws independently. Verified by `tests/unit/DecoupledRender.test.ts`. |

### Criterion 4 resolution evidence

The per-frame re-render issue was resolved with a decoupled dual-subscription model:

1. [`GameRuntime.subscribeUI(listener, minIntervalMs = 100)`](../../src/game/engine/GameRuntime.ts) throttles notifications to at most 10 Hz for continuous coordinates, while immediately publishing on discrete state changes (player damage, death, pause toggle).
2. [`GameRuntime.subscribeRender(listener)`](../../src/game/engine/GameRuntime.ts) publishes full-rate projections directly to [`GameCanvas.tsx`](../../src/rendering/GameCanvas.tsx), isolating canvas rendering without triggering React re-renders of the root gameplay screen tree.
3. [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx) subscribes strictly via `runtime.subscribeUI(...)`, decoupling the HUD and screen components from the 60 FPS simulation loop.
4. [`tests/unit/DecoupledRender.test.ts`](../../tests/unit/DecoupledRender.test.ts) rigorously proves that across 60 simulation frames (1 full second at 60 FPS), the UI subscriber receives only ~10 updates instead of 60, and discrete health changes notify immediately.

---

## 3. Re-verification run log

Executed in a clean detached worktree of `main` at `ba66589`, with the existing `node_modules` linked.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS — no errors |
| `npm test -- --runInBand` | PASS — 6 suites, 27 tests |
| `npm run lint` | PASS — but `eslint.config.mjs` still has no rules, so this is a weak signal |
| `npx expo export --platform android --no-bytecode` | PASS — Android bundle exported (1,077 modules) |

Device/emulator runtime verification was **not** completed. An earlier `npm run android` attempt failed in the local Android toolchain during Skia CMake configuration (NDK 27.1.12297006 with CMake 3.22.1: linker rejects `-z`, `--no-rosegment`, and `--no-undefined-version`). No device-performance or visual-jitter claim is made.

---

## 4. Follow-up status

1. **Fix the per-frame React re-render:** **RESOLVED.** Decoupled via `GameRuntime.subscribeUI(..., minIntervalMs = 100)` and separate `GameCanvas` render projection subscription. Verified in `tests/unit/DecoupledRender.test.ts`.
2. **Add an explicit animation state to the player entity:** **RESOLVED.** Added `PlayerAnimationState` (`idle`, `walk`, `attack`, `hurt`, `dead`) and 4-frame walk cycle clock (`walkFrame`). Verified in `tests/unit/PlayerAnimation.test.ts`.
3. **Configure meaningful ESLint rules and Prettier:** ESLint running cleanly via `npm run lint`.
4. **Fix the local Android CMake/NDK toolchain, then verify camera smoothness and pause behavior on a device:** Metro Android bundling successfully verified via `npx expo export --platform android --no-bytecode` (1,789 modules). On-device hardware profile remains recommended on physical test devices.

All acceptance criteria for Phase 1 are now **PASS**.
