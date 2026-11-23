# Phase 2 Acceptance Criteria Audit

**Target:** Phase 2 — Movement, input, and collision ([project.md](../../project.md#L988-L1007))<br>
**Initial audit in PR #11:** all tasks and criteria PASS<br>
**Independent re-verification:** 2026-11-22 at `ba29a67`<br>
**Re-verified:** 2026-11-22 (Issue #15 fix)<br>
**Status:** **3 of 4 acceptance criteria PASS; 1 UNVERIFIED. (Physical device benchmark pending).**

> **Resolution note (Issue #15):** `GameRuntime.pause()` and `handleAppStateChange` now explicitly call `inputAdapter.reset()`. Regression tests in `GameRuntime.test.ts` verify input returns to neutral after interruption and remains neutral upon resume. Runtime integration tests in `GameRuntimeCollision.test.ts` prove the player cannot pass through solid tiles or map borders via `fixedUpdate`.

---

## 1. Phase 2 task-by-task audit

| Task | Status | File-level evidence | Notes |
| --- | :---: | --- | --- |
| Implement virtual joystick or D-pad | **PASS** | [`src/input/VirtualJoystick.tsx`](../../src/input/VirtualJoystick.tsx), [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx) | Analog `PanResponder` joystick with 6 px deadzone, 52 px clamp, normalized output, plus a toggleable D-pad. |
| Convert touch input to normalized movement snapshots | **PASS** | [`src/input/VirtualJoystick.tsx`](../../src/input/VirtualJoystick.tsx), [`src/input/TouchInputAdapter.ts`](../../src/input/TouchInputAdapter.ts), [`src/game/domain/rules/MovementRules.ts`](../../src/game/domain/rules/MovementRules.ts) | Joystick emits magnitude `<= 1`; `TouchInputAdapter.readSnapshot()` exposes the vector; `applyMovementStep()` normalizes vectors longer than 1. |
| Implement speed, facing direction, and animation selection | **PASS** | [`src/game/domain/entities/PlayerEntity.ts`](../../src/game/domain/entities/PlayerEntity.ts), [`src/game/domain/rules/MovementRules.ts`](../../src/game/domain/rules/MovementRules.ts), [`tests/unit/PlayerAnimation.test.ts`](../../tests/unit/PlayerAnimation.test.ts) | Speed is 120 units/s; facing follows the dominant axis; idle/walk/attack/hurt/dead states and a 4-frame walk clock are driven by the runtime. |
| Implement collision grid and world bounds | **PASS** | [`src/game/world/CollisionGrid.ts`](../../src/game/world/CollisionGrid.ts), [`tests/unit/CollisionGrid.test.ts`](../../tests/unit/CollisionGrid.test.ts) | `isSolid()` treats out-of-bounds tiles as solid; `resolveMovement()` performs axis-separated AABB checks with sliding. There is no `clampToBounds()` API; the grid provides equivalent protection. |
| Add collision objects such as walls, rocks, and buildings | **PASS (minimal)** | [`assets/maps/village_outskirts.json`](../../assets/maps/village_outskirts.json), [`src/game/world/CollisionGrid.ts`](../../src/game/world/CollisionGrid.ts) | Solid tile IDs 4 (water) and 7 (wall/border stone) are enforced. There is no dedicated rock/building tile or separate collision layer; solidity is inferred from tile IDs across layers. |
| Handle app background/foreground transitions safely | **PARTIAL** | [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx), [`src/game/engine/GameRuntime.ts`](../../src/game/engine/GameRuntime.ts), [`src/game/engine/GameLoop.ts`](../../src/game/engine/GameLoop.ts) | Background/inactive pauses the loop and delta clamping prevents a catch-up spike. Input is not explicitly reset on interruption, and there is no automatic resume on foreground. |

---

## 2. Phase 2 acceptance criteria

| # | Criterion | Verdict | Evidence |
| --- | --- | :---: | --- |
| 1 | Player cannot pass through solid tiles or leave map bounds | **PASS** | `CollisionGrid.resolveMovement()` checks the player AABB (half extents 10 × 10 in `GameRuntime.fixedUpdate`) and `isSolid()` returns true outside the map. Runtime-level integration tests in `GameRuntimeCollision.test.ts` prove player cannot pass through solid obstacle tiles or world borders during `fixedUpdate`. |
| 2 | Cardinal speed is consistent; diagonal movement is normalized if enabled | **PASS** | `MovementRules.test.ts` verifies cardinal displacement and that `(1, 1)` produces exactly `speed × dt` total distance. Joystick vectors are already magnitude-clamped to 1. |
| 3 | Input returns to neutral on touch cancellation/app interruption | **PASS** | `GameRuntime.pause()` and `handleAppStateChange` explicitly invoke `runtime.input.reset()`. Regression tests in `GameRuntime.test.ts` prove input vector returns to `(0, 0)` and attack flag is cleared immediately on pause/interruption. |
| 4 | Player movement is stable at the target frame rate on a mid-range Android device | **UNVERIFIED** | Architecture is sound: 60 Hz fixed step, 100 ms delta clamp, 5-step catch-up cap, and 10 Hz UI projection. `npm run android` built and installed the app and opened it on a Pixel 7 emulator, but no frame-rate profiling was done on a mid-range physical device. |

### Criterion 3 resolution detail

```ts
// src/game/engine/GameRuntime.ts
pause(): void {
  if (this.isDisposed) return;
  this.session.isPaused = true;
  this.inputAdapter.reset();
  this.loop.pause();
  this.publishRender();
  this.publishUi(true);
}
```

```ts
// app/game/[saveSlotId].tsx
const handleAppStateChange = async (nextState: AppStateStatus) => {
  if (nextState.match(/inactive|background/)) {
    runtime.pause();
    runtime.input.reset();
    ...
```

Regression tests in `tests/unit/GameRuntime.test.ts` assert that active movement and attack inputs return to `{ x: 0, y: 0 }` and `isAttacking: false` immediately upon pause and remain neutral upon resume.

---

## 3. Verification run log

Executed at `ba29a67`.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS — no errors |
| `npm test -- --runInBand` | PASS — 12 suites, 44 tests |
| `npm run lint` | PASS — but no ESLint rules are configured |
| `npx expo export --platform android --no-bytecode` | PASS — 1,789 modules, 2.9 MB JS |
| `npm run android` | PASS after clearing stale `android/app/.cxx` — built, installed, and launched `com.dungeonbound.game` on Pixel 7 emulator |

Tests covering this phase: `MovementRules.test.ts`, `CollisionGrid.test.ts`, `PlayerAnimation.test.ts`, `DecoupledRender.test.ts`, `GameLoop.test.ts`, `GameRuntime.test.ts`, `Camera.test.ts`, `TileMapParser.test.ts`, `Vector2.test.ts`.

---

## 4. Required follow-up

1. Reset input on app interruption: **RESOLVED.** `GameRuntime.pause()` and `handleAppStateChange` invoke `runtime.input.reset()`.
2. Add a regression test asserting `readSnapshot().moveVector` is `(0, 0)` after `pause()` or an AppState interruption: **RESOLVED.** Covered by `GameRuntime.test.ts`.
3. Add a runtime integration test that drives the player into a solid tile and the actual map border through `GameRuntime.fixedUpdate`: **RESOLVED.** Covered by `GameRuntimeCollision.test.ts`.
4. Profile movement on a mid-range physical Android device before marking criterion 4 PASS: **OPEN (UNVERIFIED).**
5. Optionally add explicit rock/building solid tiles if the spec expects more than walls and water: **OPEN (future map expansion).**
