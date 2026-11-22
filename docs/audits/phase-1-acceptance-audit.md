# Phase 1 Acceptance Criteria Audit

**Target:** Phase 1 — Game shell and rendering foundation ([project.md](../../project.md#L965-L987))<br>
**Initial audit:** 2026-11-22<br>
**Re-verified:** 2026-11-22 after the issue #15 fixes, rebased onto Phase 5 `main`<br>
**Status:** **4 of 4 acceptance criteria PASS.** Criterion 2 is logically verified; hardware jitter was not measured.

> **Correction history:** PR #11 declared 4/4 PASS, then PR #13 downgraded criterion 4 to PARTIAL because `GameCanvas` re-rendered per frame. Issue #15 replaced that path with imperative Skia drawing, so criterion 4 is now PASS without a per-frame React state update.

---

## 1. Phase 1 task-by-task audit

| Task | Status | File-level evidence | Notes |
| --- | :---: | --- | --- |
| Implement main menu and gameplay route | **PASS** | [`app/index.tsx`](../../app/index.tsx), [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx) | Main menu renders title and navigation buttons. Gameplay route boots `GameRuntime` and mounts HUD and controls. |
| Build `GameRuntime` lifecycle: create, start, pause, resume, stop, dispose | **PASS** | [`src/game/engine/GameRuntime.ts`](../../src/game/engine/GameRuntime.ts), [`src/game/engine/GameSession.ts`](../../src/game/engine/GameSession.ts), [`tests/unit/GameRuntime.test.ts`](../../tests/unit/GameRuntime.test.ts) | Lifecycle methods are implemented and covered by unit tests. |
| Implement fixed-step loop and frame-delta clamping | **PASS** | [`src/game/engine/GameLoop.ts`](../../src/game/engine/GameLoop.ts), [`tests/unit/GameLoop.test.ts`](../../tests/unit/GameLoop.test.ts) | Fixed step is 1/60 s, delta is clamped to 0.1 s, and catch-up is capped at 5 steps. |
| Implement logical world coordinates and camera transform | **PASS** | [`src/game/world/Camera.ts`](../../src/game/world/Camera.ts), [`src/rendering/CameraRenderer.ts`](../../src/rendering/CameraRenderer.ts), [`tests/unit/Camera.test.ts`](../../tests/unit/Camera.test.ts) | World-to-screen conversion, clamping, and visible tile range are unit-tested. Visual smoothness on hardware is not measured. |
| Load a bundled tile map and draw ground/decorative layers | **PASS** | [`assets/maps/village_outskirts.json`](../../assets/maps/village_outskirts.json), [`src/game/world/TileMapParser.ts`](../../src/game/world/TileMapParser.ts), [`src/rendering/drawGameFrame.ts`](../../src/rendering/drawGameFrame.ts) | Map is authored data, validated by the parser, and drawn imperatively with viewport culling. |
| Add placeholder player sprite and animation state | **PASS** | [`src/game/domain/entities/PlayerEntity.ts`](../../src/game/domain/entities/PlayerEntity.ts), [`src/game/engine/GameRuntime.ts`](../../src/game/engine/GameRuntime.ts), [`tests/unit/PlayerAnimation.test.ts`](../../tests/unit/PlayerAnimation.test.ts) | `PlayerAnimationState` (`idle`, `walk`, `attack`, `hurt`, `dead`) and a 4-frame walk clock exist and are tested. |
| Add basic HUD and touch input visuals | **PASS** | [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx), [`src/input/TouchInputAdapter.ts`](../../src/input/TouchInputAdapter.ts) | HUD, D-pad, joystick, and pause modal are present. |

### Deliverable

> Player placeholder rendered over a scrolling tile map.

Delivered. The renderer consumes a runtime projection and draws a data-driven map with camera culling.

---

## 2. Phase 1 acceptance criteria

| # | Criterion | Verdict | Evidence |
| --- | --- | :---: | --- |
| 1 | Map is rendered from data, not hand-drawn JSX per tile | **PASS** | `village_outskirts.json` holds tile arrays; `TileMapParser` validates them into `MapDefinition`; `drawGameFrame` iterates layers and visible bounds. |
| 2 | Camera follows player without visible jitter | **PASS (logic only)** | `Camera.followTarget()` centers on the player with world clamping; `Camera.test.ts` covers center, edges, and overflow. No hardware jitter measurement was performed. |
| 3 | Opening pause menu stops simulation updates | **PASS** | `handleTogglePause()` calls `runtime.pause()`; `GameLoop.step()` skips `onFixedUpdate` while paused. Covered by `GameLoop.test.ts` and `GameRuntime.test.ts`. |
| 4 | Gameplay does not trigger React re-render on each frame | **PASS** | The gameplay screen/HUD subscribe only to `subscribeUI()` at 100 ms. `GameCanvas` no longer calls `setState` per frame: it draws through an imperative Skia `PictureRecorder` and publishes the result via a Reanimated shared value. |

### Criterion 4 evidence

1. [`GameRuntime.subscribeUI()`](../../src/game/engine/GameRuntime.ts) throttles HUD updates to 10 Hz and publishes immediately on discrete events. [`DecoupledRender.test.ts`](../../tests/unit/DecoupledRender.test.ts) proves 60 simulation steps produce at most about 12 UI notifications.
2. [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx) uses only `subscribeUI()`; it does not call `setState` from a per-frame render callback.
3. [`GameCanvas.tsx`](../../src/rendering/GameCanvas.tsx) contains no `useState` and no `runtime.subscribe()`. A `requestAnimationFrame` loop calls [`drawGameFrame()`](../../src/rendering/drawGameFrame.ts), which writes drawing commands directly to a Skia canvas; the resulting picture is stored in a shared value consumed by a single `<Picture>` node.

---

## 3. Verification run log

Executed after the issue #15 fixes.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS — no errors |
| `npm test -- --runInBand` | PASS — 23 suites, 104 tests |
| `npm run lint` | PASS — `typescript-eslint` recommended rules are now configured and enforced |
| `npx expo export --platform android --no-bytecode` | PASS — Android bundle exported (1,803 modules, 2.9 MB JS) |

Final rebased code: `npm run android` compiled successfully, the APK installed on the Pixel 7 emulator after trimming emulator caches, and `com.dungeonbound.game` opened to the Expo dev launcher. An earlier run at `ba29a67` installed and bundled the app with Metro after clearing stale `android/app/.cxx`. No physical-device frame profiling or camera-jitter measurement was performed.

---

## 4. Follow-up status

1. **Per-frame React re-render:** **RESOLVED.** Parent/HUD tree uses throttled UI projection; canvas drawing is imperative with no React state update per frame.
2. **Player animation state:** **RESOLVED.** Explicit states and walk clock are implemented and tested.
3. **Meaningful ESLint rules:** **RESOLVED.** `eslint.config.mjs` uses `typescript-eslint` recommended rules; existing unused imports/consts were cleaned up.
4. **Device verification:** **PARTIAL.** Android build/install/launch verified on an emulator; physical mid-range device profiling remains open.
