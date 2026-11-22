# Phase 5 Acceptance Criteria Audit

**Target:** Phase 5 — Local persistence and save/load ([project.md](../../project.md#L1049-L1068))<br>
**Audit Date:** 2026-11-22<br>
**Branch:** `fix/20-phase-5-persistence-audit-findings`<br>
**Status:** **Criteria 1–3 PASS; criterion 4 UNVERIFIED. One listed task is PARTIAL (map-transition/checkpoint saves).**

This audit replaces the previous claim of "all criteria PASS". That claim was unsupported: clean installs had a schema/migration mismatch, quest and world state were never serialized by the runtime, the migration upgrade test used hand-written fixtures, the atomic-save test failed before any mutation, corrupt saves could be overwritten by starter state, and no airplane-mode device run was performed.

---

## 1. Phase 5 task-by-task audit

| Task | Status | File-level evidence | Notes |
| --- | :---: | --- | --- |
| Implement SQLite schema and migrations | **PASS** | [`database.ts`](../../src/platform/persistence/database.ts), [`MigrationRunner.ts`](../../src/platform/persistence/migrations/MigrationRunner.ts), [`allMigrations.ts`](../../src/platform/persistence/migrations/allMigrations.ts), [`MigrationRunner.test.ts`](../../tests/unit/MigrationRunner.test.ts) | `database.ts` no longer creates a conflicting `schema_migrations` table. `initMigrationTable()` creates the canonical table and heals legacy installs missing the `name` column before INSERT. Clean-install and real v1→v2 upgrade tests use `ALL_MIGRATIONS`. |
| Implement save-slot repository | **PASS** | [`SaveRepository.ts`](../../src/game/domain/repositories/SaveRepository.ts), [`SQLiteSaveRepository.ts`](../../src/platform/persistence/SQLiteSaveRepository.ts), [`SQLiteSaveRepository.test.ts`](../../tests/unit/SQLiteSaveRepository.test.ts) | Parameterized CRUD, child-table upserts, cascading delete, and validation on load/save. Mock DB now honors inline SQL literals and column projection so tests reflect real queries. |
| Serialize and validate save snapshots | **PASS** | [`SaveSnapshotValidator.ts`](../../src/game/application/SaveSnapshotValidator.ts), [`GameRuntime.ts`](../../src/game/engine/GameRuntime.ts), [`SaveSnapshotValidator.test.ts`](../../tests/unit/SaveSnapshotValidator.test.ts) | Validator now rejects malformed `worldFlags`/`questState` in addition to player/inventory/equipment fields. |
| Add save/load/new/delete flows | **PASS** | [`app/index.tsx`](../../app/index.tsx), [`app/game/[saveSlotId].tsx`](../../app/game/%5BsaveSlotId%5D.tsx), [`SaveSessionGuard.ts`](../../src/game/application/SaveSessionGuard.ts) | Menu offers `PLAY`/`NEW GAME`/`DEL`; gameplay screen blocks all save writes when a slot failed validation. A corrupt save is left untouched until the user deletes it from the menu. |
| Add saves at map transitions, important events, explicit save, and controlled checkpoints | **PARTIAL** | [`app/game/[saveSlotId].tsx`](../../app/game/%5BsaveSlotId%5D.tsx) (manual save + background save), [`GameRuntime.ts`](../../src/game/engine/GameRuntime.ts) (`createSaveSnapshot`) | Manual save and lifecycle save exist. There are no map transitions or checkpoints in the app yet, so those triggers cannot be implemented or verified until Phase 6. |
| Add app lifecycle best-effort save | **PASS (code inspection)** | [`app/game/[saveSlotId].tsx`](../../app/game/%5BsaveSlotId%5D.tsx) (`AppState.addEventListener`) | Background/inactive pauses the runtime and writes through `SaveSessionGuard`. No physical lifecycle run was performed. |
| Add database failure and corrupt-save handling | **PASS** | [`SaveSnapshotValidator.ts`](../../src/game/application/SaveSnapshotValidator.ts), [`SaveSessionGuard.ts`](../../src/game/application/SaveSessionGuard.ts), [`SaveSessionGuard.test.ts`](../../tests/unit/SaveSessionGuard.test.ts), [`SQLiteSaveRepository.test.ts`](../../tests/unit/SQLiteSaveRepository.test.ts) | Corrupt loads throw; the guard blocks subsequent saves; a mid-transaction failure rolls back metadata/player/inventory writes. |

---

## 2. Phase 5 acceptance criteria

| # | Criterion | Verdict | Evidence | Reason |
| --- | --- | :---: | --- | --- |
| 1 | Player position, level, XP, HP, inventory, equipment, quest state, and world flags survive force-close/relaunch | **PASS (simulated)** | [`GameRuntime.ts`](../../src/game/engine/GameRuntime.ts) (`createSaveSnapshot`/`loadFromSnapshot`), [`GameSession.ts`](../../src/game/engine/GameSession.ts), [`SQLiteSaveRepository.ts`](../../src/platform/persistence/SQLiteSaveRepository.ts), [`PersistenceIntegration.test.ts`](../../tests/unit/PersistenceIntegration.test.ts) | Runtime now stores and serializes `worldFlags`/`questState`; repository persists them in `world_flags`/`quest_progress`. Integration test disposes one runtime, boots a fresh one, and asserts all fields including quest/world state. This is a simulated process restart, not a physical force-close. |
| 2 | A save transaction cannot leave a partially updated inventory/player snapshot | **PASS** | [`SQLiteSaveRepository.ts:161-279`](../../src/platform/persistence/SQLiteSaveRepository.ts), [`SQLiteSaveRepository.test.ts`](../../tests/unit/SQLiteSaveRepository.test.ts) | Test now injects failure on an `INSERT INTO inventory_items` **after** metadata, player, and DELETE writes, then verifies the previous player level, HP, and full inventory remain intact. |
| 3 | Migrations work from an earlier schema fixture | **PASS** | [`MigrationRunner.ts`](../../src/platform/persistence/migrations/MigrationRunner.ts), [`MigrationRunner.test.ts`](../../tests/unit/MigrationRunner.test.ts) | Test uses the real `ALL_MIGRATIONS`: applies only v1, asserts v2-only table absent, then applies v2 and asserts table names/versions. A separate test heals a legacy `schema_migrations` table without `name`. |
| 4 | Airplane-mode save/load works | **UNVERIFIED** | [`database.ts`](../../src/platform/persistence/database.ts), [`SQLiteSaveRepository.ts`](../../src/platform/persistence/SQLiteSaveRepository.ts) | Static evidence shows only local Expo SQLite with no network calls, and the Android Metro bundle exports. No physical device was put in airplane mode and no force-close/relaunch run was performed, so end-to-end offline behavior is not claimed. |

---

## 3. Verification run log

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS — 0 TypeScript errors |
| `npm test -- --runInBand` | PASS — 24 suites, 123 tests |
| `npm run lint` | PASS — 0 ESLint errors |
| `npx expo export --platform android --no-bytecode` | PASS — 1,806 modules, 2.9 MB JS |

---

## 4. Notes

1. `CURRENT_SAVE_VERSION` remains `1`; no new migration was required because `world_flags` and `quest_progress` tables already existed in migration 001. The gap was that the runtime never wrote to them.
2. `SaveSessionGuard.allowNewGame()` is the explicit recovery escape hatch for callers that delete a corrupt slot and start fresh; the gameplay error screen currently sends the user back to the menu, where `DEL` performs that deletion.
3. Quest/world state values are JSON-serialized primitives and JSON-serializable objects. The validator rejects non-primitive world-flag values and non-object `questState`.
4. No device, frame-rate, or offline-force-close result is claimed.
