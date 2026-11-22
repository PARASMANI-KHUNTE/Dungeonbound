# Phase 1 Acceptance Criteria Audit

**Target:** Phase 1 — Game shell and rendering foundation ([project.md](../project.md#L965-L987))<br>
**Initial audit:** 2026-11-22<br>
**Re-verified:** 2026-11-22 (clean worktree at `ba66589`)<br>
**Status:** **3 of 4 acceptance criteria PASS; 1 FAIL. Phase 1 is NOT fully verified.**

> This document was corrected after independent re-verification found that the original "all criteria PASS" verdict was wrong. The failing criterion is #4: gameplay currently triggers a React re-render on every frame.

---

## 1. Phase 1 task-by-task audit

| Task | Status | File-level evidence | Notes |
| --- | :---: | --- | --- |
| Implement main menu and gameplay route | **PASS** | [`app/index.tsx`](../../app/index.tsx), [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx) | Main menu renders title and navigation buttons. Gameplay route loads the map, boots `GameRuntime`, and mounts HUD plus touch controls. |
| Build `GameRuntime` lifecycle: create, start, pause, resume, stop, dispose | **PASS** | [`src/game/engine/GameRuntime.ts`](../../src/game/engine/GameRuntime.ts), [`src/game/engine/GameSession.ts`](../../src/game/engine/GameSession.ts), [`tests/unit/GameRuntime.test.ts`](../../tests/unit/GameRuntime.test.ts) | Lifecycle methods are implemented and covered by unit tests. |
| Implement fixed-step loop and frame-delta clamping | **PASS** | [`src/game/engine/GameLoop.ts`](../../src/game/engine/GameLoop.ts), [`tests/unit/GameLoop.test.ts`](../../tests/unit/GameLoop.test.ts) | Fixed step is 1/60 s, frame delta is clamped to 0.1 s, and catch-up is capped at 5 steps. Pause/resume resets the timestamp baseline. |
| Implement logical world coordinates and camera transform | **PASS** | [`src/game/world/Camera.ts`](../../src/game/world/Camera.ts), [`src/rendering/CameraRenderer.ts`](../../src/rendering/CameraRenderer.ts), [`tests/unit/Camera.test.ts`](../../tests/unit/Camera.test.ts) | World-to-screen conversion, clamping, and visible tile range are unit-tested. Visual smoothness was not verified on a device. |
| Load a bundled tile map and draw ground/decorative layers | **PASS** | [`assets/maps/village_outskirts.json`](../../assets/maps/village_outskirts.json), [`src/game/world/TileMapParser.ts`](../../src/game/world/TileMapParser.ts), [`src/game/content/definitions/maps.ts`](../../src/game/content/definitions/maps.ts), [`src/rendering/GameCanvas.tsx`](../../src/rendering/GameCanvas.tsx) | Map is authored data, validated by the parser, and rendered dynamically with culling. |
| Add placeholder player sprite and animation state | **PARTIAL** | [`src/game/domain/entities/PlayerEntity.ts`](../../src/game/domain/entities/PlayerEntity.ts), [`src/rendering/GameCanvas.tsx`](../../src/rendering/GameCanvas.tsx) | A placeholder sprite with facing indicator exists. There is no animation state (for example idle/walk frame or animation clock), so this task is not fully complete. |
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
| 4 | Gameplay does not trigger React re-render on each frame | **FAIL** | See detailed evidence below. |

### Criterion 4 failure evidence

The simulation is decoupled from React state updates, but the render projection is not:

1. [`GameLoop.step()`](../../src/game/engine/GameLoop.ts) calls `this.callbacks.onRender(nowMs)` on every frame.
2. [`GameRuntime`](../../src/game/engine/GameRuntime.ts) wires `onRender: () => this.publishProjection()`.
3. [`publishProjection()`](../../src/game/engine/GameRuntime.ts) notifies every subscriber on each call.
4. [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx) subscribes with `setProjection(newProj)`.

Therefore React state is updated and the gameplay screen re-renders every frame. The original audit incorrectly treated the absence of `setState` inside the fixed update as sufficient proof; the render callback path invalidates that claim.

A correct fix should keep the simulation/projection in a runtime object and expose a throttled UI-state projection (for example only on meaningful HUD changes) or use a Skia frame callback that reads runtime state directly without React state updates.

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

## 4. Required follow-up

1. Fix the per-frame React re-render before treating Phase 1 as fully accepted.
2. Add an explicit animation state to the player entity or document that the placeholder intentionally has none.
3. Configure meaningful ESLint rules and Prettier.
4. Fix the local Android CMake/NDK toolchain, then verify camera smoothness and pause behavior on a device.

After those items, the next milestone is Phase 2 — movement, input, and collision.
