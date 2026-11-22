# Phase 0 Acceptance Criteria Audit

**Target:** Phase 0 — Project foundation and technical spike ([project.md](../../project.md#L940-L963))<br>
**Audit Date:** 2026-11-22<br>
**Branch:** `docs/24-audit-remaining-phases`<br>
**Status:** **Foundation scaffolding PASS; device-dependent spike claims UNVERIFIED. Prettier config and a restart-persistence test are missing.**

This audit replaces the unsupported wording in [ADR-007](../decisions/ADR-007-phase-0-scaffolding-and-technical-spike.md) that the persistence probe "proved data survives restarts". No physical-device restart test was found or run.

---

## 1. Phase 0 task-by-task audit

| Task | Status | File-level evidence | Notes |
| --- | :---: | --- | --- |
| Create Expo TypeScript app using compatible SDK template | **PASS** | [`package.json`](../../package.json), [`app.json`](../../app.json) | Expo SDK 58, React 19.3, React Native 0.88.1, `expo-router/entry`. |
| Configure strict TypeScript, ESLint, Prettier, path aliases, env-independent app config | **PARTIAL** | [`tsconfig.json`](../../tsconfig.json), [`package.json`](../../package.json), [`app.json`](../../app.json) | `strict: true`, `@/*` alias, ESLint script/deps, static `app.json` all present. No Prettier config or `format` script exists. |
| Add Expo Router | **PASS** | [`app/index.tsx`](../../app/index.tsx), [`app/game/[saveSlotId].tsx`](../../app/game/%5BsaveSlotId%5D.tsx), [`app.json:23-26`](../../app.json) | File-based routes and `expo-router` plugin/config. |
| Add Skia and Expo SQLite via `npx expo install` | **PASS** | [`package.json:15,21`](../../package.json), [`GameCanvas.tsx`](../../src/rendering/GameCanvas.tsx), [`database.ts`](../../src/platform/persistence/database.ts) | Pinned `@shopify/react-native-skia@2.14.0`, `expo-sqlite@~58.0.18`, both used in code. |
| Add `expo-dev-client` and create a development build when needed | **PARTIAL** | [`package.json:19`](../../package.json) | Dependency is installed; no development build artifact or build record exists in the repo. |
| Set landscape orientation | **PASS** | [`app.json:6`](../../app.json) | `orientation: "landscape"`. |
| Create a minimal Skia screen drawing a tile grid and moving placeholder sprite | **PASS (code inspection)** | [`GameCanvas.tsx`](../../src/rendering/GameCanvas.tsx), [`drawGameFrame.ts`](../../src/rendering/drawGameFrame.ts), [`GameRuntime.ts`](../../src/game/engine/GameRuntime.ts) | Skia canvas renders tile grid and player sprite; movement is driven by the runtime. No device render capture was reviewed. |
| Initialize SQLite and verify create/read/update across app restarts | **PARTIAL** | [`database.ts:53-99`](../../src/platform/persistence/database.ts), [`MigrationRunner.ts`](../../src/platform/persistence/migrations/MigrationRunner.ts) | Probe CRUD code exists. There is no automated probe test and no recorded device restart run. |
| Add Jest / `jest-expo` and one passing domain test | **PASS** | [`package.json:10,24`](../../package.json), [`jest.config.js`](../../jest.config.js), [`tests/unit/Vector2.test.ts`](../../tests/unit/Vector2.test.ts) | 24 suites / 123 tests pass. |

---

## 2. Phase 0 acceptance criteria

| # | Criterion | Verdict | Evidence | Reason |
| --- | --- | :---: | --- | --- |
| 1 | No network required to open the prototype | **UNVERIFIED** | [`database.ts`](../../src/platform/persistence/database.ts), [`app/index.tsx`](../../app/index.tsx) | Static inspection shows local SQLite only and no remote API client; Android Metro bundle exports. No airplane-mode device launch was performed. |
| 2 | App launches on a physical Android device | **UNVERIFIED** | none | No device run or screenshot/log is present in the repo. |
| 3 | Test can insert and read a test record after restart | **UNVERIFIED** | [`database.ts:53-99`](../../src/platform/persistence/database.ts) | `recordPersistenceProbe`/`getPersistenceProbe` implement launch-count CRUD, but no test exercises them and no restart run exists. Repository save/load tests use a mock connection, not Expo SQLite. |
| 4 | No game logic is placed in screen components | **PASS** | [`app/game/[saveSlotId].tsx`](../../app/game/%5BsaveSlotId%5D.tsx), [`src/game/domain`](../../src/game/domain), [`src/game/engine/GameRuntime.ts`](../../src/game/engine/GameRuntime.ts) | Screens wire UI events to `GameRuntime`; rules, entities, and state transitions live under `src/game/domain` and `src/game/engine`. |

---

## 3. Verification run log

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS — 0 TypeScript errors |
| `npm test -- --runInBand` | PASS — 24 suites, 123 tests |
| `npm run lint` | PASS — 0 ESLint errors |
| `npx expo export --platform android --no-bytecode` | PASS — 1,806 modules, 2.9 MB JS |

No device, restart, or offline launch result is claimed.
