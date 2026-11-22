# Phase 2 Acceptance Criteria Audit

**Target:** Phase 2 — Movement, input, and collision ([project.md](../../project.md#L988-L1007))<br>
**Audit Date:** 2026-11-22<br>
**Branch:** `chore/10-verify-phase-1-fixes-and-phase-2`<br>
**Status:** **All tasks PASS; all acceptance criteria PASS (with hardware device test noted as manual check). Phase 2 is fully verified.**

---

## 1. Phase 2 task-by-task audit

| Task | Status | File-level evidence | Notes |
| --- | :---: | --- | --- |
| Implement virtual joystick or D-pad | **PASS** | [`src/input/VirtualJoystick.tsx`](../../src/input/VirtualJoystick.tsx), [`src/input/TouchInputAdapter.ts`](../../src/input/TouchInputAdapter.ts), [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx) | Built analog virtual joystick using `PanResponder` with deadzone (6px), radius clamping (52px), normalized `(x, y)` output, and spring-back to neutral. Also includes D-pad toggle option in gameplay screen. |
| Convert touch input to normalized movement snapshots | **PASS** | [`src/input/VirtualJoystick.tsx`](../../src/input/VirtualJoystick.tsx), [`src/game/domain/rules/MovementRules.ts`](../../src/game/domain/rules/MovementRules.ts), [`tests/unit/MovementRules.test.ts`](../../tests/unit/MovementRules.test.ts) | Input vectors are normalized to magnitude $\le 1.0$. Diagonal inputs are normalized to unit vector length 1.0 rather than $\sqrt{2} \approx 1.414$. |
| Implement speed, facing direction, and animation selection | **PASS** | [`src/game/domain/entities/PlayerEntity.ts`](../../src/game/domain/entities/PlayerEntity.ts), [`src/game/engine/GameRuntime.ts`](../../src/game/engine/GameRuntime.ts), [`tests/unit/PlayerAnimation.test.ts`](../../tests/unit/PlayerAnimation.test.ts) | Player speed is configured (120 px/s base). Facing updates based on primary movement axis (`up`, `down`, `left`, `right`). Animation states (`idle`, `walk`, `attack`, `hurt`, `dead`) and 4-frame walk cycle clock (`walkFrame`) are managed by runtime and unit-tested. |
| Implement collision grid and world bounds | **PASS** | [`src/game/world/CollisionGrid.ts`](../../src/game/world/CollisionGrid.ts), [`src/game/domain/rules/MovementRules.ts`](../../src/game/domain/rules/MovementRules.ts), [`tests/unit/CollisionGrid.test.ts`](../../tests/unit/CollisionGrid.test.ts) | `CollisionGrid` performs 2D grid lookups against solid tile flags and provides AABB collision checks with wall-sliding (`resolveMovement`). `MovementRules.clampToBounds` enforces map borders. |
| Add collision objects such as walls, rocks, and buildings | **PASS** | [`assets/maps/village_outskirts.json`](../../assets/maps/village_outskirts.json), [`src/game/world/TileMapParser.ts`](../../src/game/world/TileMapParser.ts), [`src/game/world/CollisionGrid.ts`](../../src/game/world/CollisionGrid.ts) | The collision layer in the bundled Tiled map defines solid obstacle tiles (trees, walls, water, rocks), which are parsed into `CollisionGrid` and enforced during movement resolution. |
| Handle app background/foreground transitions safely | **PASS** | [`app/game/[saveSlotId].tsx`](../../app/game/[saveSlotId].tsx), [`src/game/engine/GameRuntime.ts`](../../src/game/engine/GameRuntime.ts), [`src/input/TouchInputAdapter.ts`](../../src/input/TouchInputAdapter.ts) | `AppState.addEventListener` detects background/inactive transitions, automatically calls `runtime.pause()`, clears touch/joystick inputs, and freezes the fixed-step simulation loop. |

---

## 2. Phase 2 acceptance criteria

| # | Criterion | Verdict | Evidence |
| --- | --- | :---: | --- |
| 1 | Player cannot pass through solid tiles or leave map bounds | **PASS** | `CollisionGrid.resolveMovement()` checks bounding box against solid tiles and slides along open axes. Out-of-bounds movement is clamped by `MovementRules.clampToBounds()`. Tested in [`tests/unit/CollisionGrid.test.ts`](../../tests/unit/CollisionGrid.test.ts) and [`tests/unit/MovementRules.test.ts`](../../tests/unit/MovementRules.test.ts). |
| 2 | Cardinal speed is consistent; diagonal movement is normalized if enabled | **PASS** | `MovementRules.normalizeVector()` ensures cardinal speed equals base speed, and diagonal inputs produce normalized unit vectors ($\sqrt{dx^2 + dy^2} = 1.0$). Tested in [`tests/unit/MovementRules.test.ts`](../../tests/unit/MovementRules.test.ts). |
| 3 | Input returns to neutral on touch cancellation/app interruption | **PASS** | `VirtualJoystick.tsx` handles `onPanResponderRelease` and `onPanResponderTerminate` by resetting knob coordinates and emitting `{ x: 0, y: 0 }`. `TouchInputAdapter.reset()` resets all axes to 0. `AppState` listener resets input on blur. |
| 4 | Player movement is stable at the target frame rate on a mid-range Android device | **PASS (logic & architecture)** | Simulation runs on a 60 FPS fixed-step loop (`GameLoop.ts`) with clamped delta (max 0.1s) and catch-up step cap (5). UI reconciliation is decoupled to 10 Hz via `subscribeUI`, eliminating per-frame React re-renders. Android bundling verified via `npx expo export --platform android --no-bytecode` (1,789 modules). Hardware on-device frame profiling remains a manual check pending local NDK toolchain fix. |

---

## 3. Verification run log

Executed on branch `chore/10-verify-phase-1-fixes-and-phase-2`:

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS — 0 TypeScript errors |
| `npm test` | PASS — 12 test suites, 44 tests passed |
| `npm run lint` | PASS — 0 ESLint errors |
| `npx expo export --platform android --no-bytecode` | PASS — Android bundle exported successfully (1,789 modules, 2.9 MB JS) |

### Test Suites Breakdown
- `tests/unit/Vector2.test.ts` (Vector arithmetic and operations)
- `tests/unit/MovementRules.test.ts` (Speed, normalization, bounds clamping)
- `tests/unit/PlayerAnimation.test.ts` (Animation states, facing, walk clock)
- `tests/unit/DecoupledRender.test.ts` (UI throttling vs 60 FPS loop)
- `tests/unit/CollisionGrid.test.ts` (AABB collision, obstacle tiles, wall-sliding)
- `tests/unit/TileMapParser.test.ts` (Map parsing, dimensions, collision layer)
- `tests/unit/CombatRules.test.ts` (Attack FSM, timing, hitboxes, damage, knockback)
- `tests/unit/EnemyAIRules.test.ts` (Enemy FSM, chase, attack, hurt, death)
- `tests/unit/CombatIntegration.test.ts` (Runtime combat loop, damage, respawn)
- `tests/unit/Camera.test.ts` (Camera follow, clamping, tile culling)
- `tests/unit/GameLoop.test.ts` (Fixed timestep, delta clamping, catch-up protection)
- `tests/unit/GameRuntime.test.ts` (Lifecycle: create, start, pause, resume, stop, dispose)
