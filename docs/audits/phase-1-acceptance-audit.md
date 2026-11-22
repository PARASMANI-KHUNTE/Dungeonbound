# Phase 1 Acceptance Criteria Audit

**Target:** Phase 1 — Game shell and rendering foundation ([project.md](../../project.md#L965-L987))<br>
**Initial audit:** 2026-11-22<br>
**Re-verified:** 2026-11-22 at `ba29a67` (after PR #11)<br>
**Status:** **3 of 4 acceptance criteria PASS; criterion 4 is PARTIAL under a literal reading. Phase 1 is functionally complete but not strictly fully verified.**

> **Correction note:** PR #11 declared 4 of 4 criteria PASS. Independent re-check confirms that the reported gameplay-screen/HUD re-render problem is fixed, but `GameCanvas` still calls `setProjection()` on every render projection. The HUD and control tree no longer re-render per frame; the canvas subtree does.

---

## 1. Phase 1 task-by-task audit

| Task | Status | File-level evidence | Notes |
| --- | :---: | --- | --- |
| Implement main menu and gameplay route | **PASS** | [`app/index.tsx`](../../app/index.tsx), [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx) | Main menu renders title and navigation buttons. Gameplay route boots `GameRuntime` and mounts HUD and controls. |
| Build `GameRuntime` lifecycle: create, start, pause, resume, stop, dispose | **PASS** | [`src/game/engine/GameRuntime.ts`](../../src/game/engine/GameRuntime.ts), [`src/game/engine/GameSession.ts`](../../src/game/engine/GameSession.ts), [`tests/unit/GameRuntime.test.ts`](../../tests/unit/GameRuntime.test.ts) | Lifecycle methods are implemented and covered by unit tests. |
| Implement fixed-step loop and frame-delta clamping | **PASS** | [`src/game/engine/GameLoop.ts`](../../src/game/engine/GameLoop.ts), [`tests/unit/GameLoop.test.ts`](../../tests/unit/GameLoop.test.ts) | Fixed step is 1/60 s, delta is clamped to 0.1 s, and catch-up is capped at 5 steps. |
| Implement logical world coordinates and camera transform | **PASS** | [`src/game/world/Camera.ts`](../../src/game/world/Camera.ts), [`src/rendering/CameraRenderer.ts`](../../src/rendering/CameraRenderer.ts), [`tests/unit/Camera.test.ts`](../../tests/unit/Camera.test.ts) | World-to-screen conversion, clamping, and visible tile range are unit-tested. Visual smoothness on hardware is not measured. |
| Load a bundled tile map and draw ground/decorative layers | **PASS** | [`assets/maps/village_outskirts.json`](../../assets/maps/village_outskirts.json), [`src/game/world/TileMapParser.ts`](../../src/game/world/TileMapParser.ts), [`src/rendering/GameCanvas.tsx`](../../src/rendering/GameCanvas.tsx) | Map is authored data, validated by the parser, and drawn with viewport culling. |
| Add placeholder player sprite and animation state | **PASS** | [`src/game/domain/entities/PlayerEntity.ts`](../../src/game/domain/entities/PlayerEntity.ts), [`src/game/engine/GameRuntime.ts`](../../src/game/engine/GameRuntime.ts), [`tests/unit/PlayerAnimation.test.ts`](../../tests/unit/PlayerAnimation.test.ts) | `PlayerAnimationState` (`idle`, `walk`, `attack`, `hurt`, `dead`) and a 4-frame walk clock exist and are tested. |
| Add basic HUD and touch input visuals | **PASS** | [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx), [`src/input/TouchInputAdapter.ts`](../../src/input/TouchInputAdapter.ts) | HUD, D-pad, joystick, and pause modal are present. |

### Deliverable

> Player placeholder rendered over a scrolling tile map.

Delivered. The renderer consumes a runtime projection and draws a data-driven map with camera culling.

---

## 2. Phase 1 acceptance criteria

| # | Criterion | Verdict | Evidence |
| --- | --- | :---: | --- |
| 1 | Map is rendered from data, not hand-drawn JSX per tile | **PASS** | `village_outskirts.json` holds tile arrays; `TileMapParser` validates them into `MapDefinition`; `GameCanvas` iterates layers and visible bounds. |
| 2 | Camera follows player without visible jitter | **PASS (logic only)** | `Camera.followTarget()` centers on the player with world clamping; `Camera.test.ts` covers center, edges, and overflow. No hardware jitter measurement was performed. |
| 3 | Opening pause menu stops simulation updates | **PASS** | `handleTogglePause()` calls `runtime.pause()`; `GameLoop.step()` skips `onFixedUpdate` while paused. Covered by `GameLoop.test.ts` and `GameRuntime.test.ts`. |
| 4 | Gameplay does not trigger React re-render on each frame | **PARTIAL** | The gameplay screen/HUD now subscribes only to `subscribeUI()` at a 100 ms cadence, so the original defect is fixed. However, `GameCanvas` subscribes with `subscribe()` and calls `setProjection()` on every frame, so a React component in the gameplay tree still re-renders at frame rate. |

### Criterion 4 evidence

1. [`GameRuntime.subscribeUI()`](../../src/game/engine/GameRuntime.ts) throttles HUD updates to 10 Hz and publishes immediately on discrete events. [`DecoupledRender.test.ts`](../../tests/unit/DecoupledRender.test.ts) proves 60 simulation steps produce at most about 12 UI notifications.
2. [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx) uses only `subscribeUI()`; it no longer calls `setState` from the render callback.
3. [`GameCanvas.tsx`](../../src/rendering/GameCanvas.tsx) still uses `useState` plus `runtime.subscribe()` and sets that state on every `onRender` callback. The re-render is isolated to the canvas subtree, but it is still a per-frame React render.

A fully strict PASS requires an imperative Skia frame callback or ref-based draw that reads runtime state without React `setState` per frame.

---

## 3. Verification run log

Executed at `ba29a67` with the project dependencies installed.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS — no errors |
| `npm test -- --runInBand` | PASS — 12 suites, 44 tests |
| `npm run lint` | PASS — but `eslint.config.mjs` contains only ignores, so this is a weak signal |
| `npx expo export --platform android --no-bytecode` | PASS — Android bundle exported (1,789 modules, 2.9 MB JS) |
| `npm run android` | PASS after clearing stale `android/app/.cxx` — built and installed `com.dungeonbound.game`, opened on Pixel 7 emulator |

No physical-device frame profiling or camera-jitter measurement was performed.

---

## 4. Follow-up status

1. **Per-frame React re-render:** **PARTIAL.** Parent gameplay/HUD tree fixed; canvas subtree still re-renders per frame.
2. **Player animation state:** **RESOLVED.** Explicit states and walk clock are implemented and tested.
3. **Meaningful ESLint/Prettier rules:** **OPEN.** Lint passes only because no rules are configured.
4. **Device verification:** **PARTIAL.** Android build/install/launch verified on an emulator; physical mid-range device profiling remains open.
