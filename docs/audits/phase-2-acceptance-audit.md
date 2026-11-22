# Phase 2 Acceptance Criteria Audit

**Target:** Phase 2 — Movement, input, and collision ([project.md](../../project.md#L988-L1007))<br>
**Initial audit in PR #11:** all tasks and criteria PASS<br>
**Independent re-verification:** 2026-11-22 at `ba29a67` (PR #13), then after the issue #15 fixes and rebased onto Phase 5 `main`<br>
**Status:** **3 of 4 acceptance criteria PASS; 1 UNVERIFIED. Phase 2 is functionally verified except for physical-device frame profiling.**

> **Correction history:** PR #13 removed nonexistent API references (`MovementRules.clampToBounds`, `GameRuntime.subscribeRender`) and marked interruption input reset as FAIL. Issue #15 added the missing reset, a regression test, and a runtime collision integration test, so criteria 1 and 3 now PASS.

---

## 1. Phase 2 task-by-task audit

| Task | Status | File-level evidence | Notes |
| --- | :---: | --- | --- |
| Implement virtual joystick or D-pad | **PASS** | [`src/input/VirtualJoystick.tsx`](../../src/input/VirtualJoystick.tsx), [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx) | Analog `PanResponder` joystick with 6 px deadzone, 52 px clamp, normalized output, plus a toggleable D-pad. |
| Convert touch input to normalized movement snapshots | **PASS** | [`src/input/VirtualJoystick.tsx`](../../src/input/VirtualJoystick.tsx), [`src/input/TouchInputAdapter.ts`](../../src/input/TouchInputAdapter.ts), [`src/game/domain/rules/MovementRules.ts`](../../src/game/domain/rules/MovementRules.ts) | Joystick emits magnitude `<= 1`; `TouchInputAdapter.readSnapshot()` exposes the vector; `applyMovementStep()` normalizes vectors longer than 1. |
| Implement speed, facing direction, and animation selection | **PASS** | [`src/game/domain/entities/PlayerEntity.ts`](../../src/game/domain/entities/PlayerEntity.ts), [`src/game/domain/rules/MovementRules.ts`](../../src/game/domain/rules/MovementRules.ts), [`tests/unit/PlayerAnimation.test.ts`](../../tests/unit/PlayerAnimation.test.ts) | Speed is 120 units/s; facing follows the dominant axis; idle/walk/attack/hurt/dead states and a 4-frame walk clock are driven by the runtime. |
| Implement collision grid and world bounds | **PASS** | [`src/game/world/CollisionGrid.ts`](../../src/game/world/CollisionGrid.ts), [`tests/unit/CollisionGrid.test.ts`](../../tests/unit/CollisionGrid.test.ts), [`tests/unit/GameRuntimeCollision.test.ts`](../../tests/unit/GameRuntimeCollision.test.ts) | `isSolid()` treats out-of-bounds tiles as solid; `resolveMovement()` performs axis-separated AABB checks with sliding. There is no `clampToBounds()` API; the grid provides equivalent protection. New integration tests drive `GameRuntime.fixedUpdate` into a solid tile and the map border. |
| Add collision objects such as walls, rocks, and buildings | **PASS (minimal)** | [`assets/maps/village_outskirts.json`](../../assets/maps/village_outskirts.json), [`src/game/world/CollisionGrid.ts`](../../src/game/world/CollisionGrid.ts) | Solid tile IDs 4 (water) and 7 (wall/border stone) are enforced. There is no dedicated rock/building tile or separate collision layer; solidity is inferred from tile IDs across layers. |
| Handle app background/foreground transitions safely | **PASS** | [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx), [`src/game/engine/GameRuntime.ts`](../../src/game/engine/GameRuntime.ts), [`tests/unit/GameRuntime.test.ts`](../../tests/unit/GameRuntime.test.ts) | Background/inactive pauses the loop, delta clamping prevents a catch-up spike, and `GameRuntime.pause()` now clears held input. Foreground does not auto-resume; the player resumes manually. |

---

## 2. Phase 2 acceptance criteria

| # | Criterion | Verdict | Evidence |
| --- | --- | :---: | --- |
| 1 | Player cannot pass through solid tiles or leave map bounds | **PASS** | `CollisionGrid.resolveMovement()` checks the player AABB (half extents 10 × 10 in `GameRuntime.fixedUpdate`) and `isSolid()` returns true outside the map. `CollisionGrid.test.ts` covers solid tiles, wall sliding, and out-of-bounds behavior. `GameRuntimeCollision.test.ts` now verifies both cases through the real `fixedUpdate` path. |
| 2 | Cardinal speed is consistent; diagonal movement is normalized if enabled | **PASS** | `MovementRules.test.ts` verifies cardinal displacement and that `(1, 1)` produces exactly `speed × dt` total distance. Joystick vectors are already magnitude-clamped to 1. |
| 3 | Input returns to neutral on touch cancellation/app interruption | **PASS** | `VirtualJoystick.onPanResponderRelease/Terminate` emit `(0, 0)`. `handleAppStateChange` calls `runtime.pause()`, and `GameRuntime.pause()` now calls `inputAdapter.reset()`. `GameRuntime.test.ts` asserts movement/attack/dodge flags return to neutral after `pause()` and `stop()`. |
| 4 | Player movement is stable at the target frame rate on a mid-range Android device | **UNVERIFIED** | Architecture is sound: 60 Hz fixed step, 100 ms delta clamp, 5-step catch-up cap, 10 Hz UI projection, and imperative Skia drawing. `npm run android` built, installed, and opened the app on a Pixel 7 emulator, but no frame-rate profiling was done on a mid-range physical device. |

### Criterion 3 fix detail

```ts
// src/game/engine/GameRuntime.ts
pause(): void {
  if (this.isDisposed) return;
  this.session.isPaused = true;
  this.loop.pause();
  this.inputAdapter.reset();
  this.publishRender();
  this.publishUi(true);
}
```

`stop()` also resets the adapter. The AppState listener does not need a second reset because it pauses through this method.

---

## 3. Verification run log

Executed after the issue #15 fixes.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS — no errors |
| `npm test -- --runInBand` | PASS — 23 suites, 104 tests |
| `npm run lint` | PASS — `typescript-eslint` recommended rules enabled |
| `npx expo export --platform android --no-bytecode` | PASS — 1,803 modules, 2.9 MB JS |

Final rebased code: `npm run android` compiled successfully, the APK installed on the Pixel 7 emulator after trimming emulator caches, and `com.dungeonbound.game` opened to the Expo dev launcher. An earlier run at `ba29a67` installed and bundled the app with Metro after clearing stale `android/app/.cxx`.

Tests covering this phase: `MovementRules.test.ts`, `CollisionGrid.test.ts`, `GameRuntimeCollision.test.ts`, `PlayerAnimation.test.ts`, `DecoupledRender.test.ts`, `GameLoop.test.ts`, `GameRuntime.test.ts`, `Camera.test.ts`, `TileMapParser.test.ts`, `Vector2.test.ts`.

---

## 4. Remaining follow-up

1. Profile movement on a mid-range physical Android device before marking criterion 4 PASS.
2. Optionally add explicit rock/building solid tiles if the spec expects more than walls and water.
3. Optionally auto-resume on foreground if product requirements call for it; current behavior requires the player to resume manually.
