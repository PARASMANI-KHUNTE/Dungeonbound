# Dungeonbound: The Lost Realm

> **Status:** Phase 3 (Combat & Enemy AI) complete.

Dungeonbound is an **offline-first, single-player 2D top-down action RPG** for mobile. The player explores an interconnected fantasy realm, accepts quests in a safe village hub, descends into dungeons, fights enemies, collects loot, and returns stronger.

The game is built with **React Native + Expo SDK 58 + TypeScript + React Native Skia + Expo SQLite**. It requires no network connection to boot, render, move, fight, or save.

---

## Technical Stack & Architecture

| Layer | Technology | Purpose |
| --- | --- | --- |
| Framework | Expo SDK 58 / React Native 0.88 / React 19.3 | Cross-platform mobile foundation (Android-first) |
| Language | TypeScript (`strict: true`) | Safe contracts, domain encapsulation |
| Rendering | `@shopify/react-native-skia` | 2D canvas, tile layers, sprites, attack slashes, effects |
| Navigation | Expo Router | Application screens, HUD, modals |
| Persistence | `expo-sqlite` (WAL mode) | Durable save snapshots, offline progress |
| Domain Tests | Jest + `jest-expo` | Unit tests for pure rules (movement, combat, math) |

### Layer Boundaries

- `app/`: Expo Router routes and application screens (`index.tsx` Main Menu, `game/[saveSlotId].tsx` Gameplay).
- `src/ui/`: UI components, menus, touch controls, HUD.
- `src/game/domain/`: Pure domain types, value objects, rules (0 imports from React, Skia, Expo, SQLite).
- `src/game/engine/`: Game loop (`GameLoop.ts`), session lifecycle (`GameRuntime.ts`), update scheduler.
- `src/game/world/`: Maps (`MapDefinition.ts`), tile parser (`TileMapParser.ts`), camera follow (`Camera.ts`), collision grid (`CollisionGrid.ts`).
- `src/game/application/`: Read-only projections (`GameProjection.ts`).
- `src/rendering/`: Skia canvas (`GameCanvas.tsx`) and camera coordinate renderer (`CameraRenderer.ts`).
- `src/input/`: Touch adapter (`TouchInputAdapter.ts`) and virtual controls.
- `src/platform/persistence/`: SQLite database, migrations, repositories.
- `tests/`: Domain unit tests and integration tests.

---

## Development Setup

### Prerequisites

- Node.js (v20+ or v24+)
- npm 10+
- Android Studio / Android Emulator or physical Android device

### Installation

```bash
npm install
```

### Available Scripts

- **Run Dev Server:** `npm start`
- **Launch on Android:** `npm run android`
- **Run Unit Tests:** `npm test`
- **Typecheck:** `npm run typecheck`
- **Lint:** `npm run lint`

---

## Implemented Phases

### Phase 0 — Foundation & Technical Spike
- [x] Scaffolding with Expo SDK 58, React Native 0.88, React 19.3, TypeScript in strict mode.
- [x] Landscape orientation locked in `app.json`.
- [x] `@shopify/react-native-skia` 2D canvas spike.
- [x] `expo-sqlite` database initialization with WAL mode, schema migrations table, and persistence probe.
- [x] Pure domain modules (`Vector2` and `MovementRules`).

### Phase 1 — Game Shell & Rendering Foundation
- [x] Main menu (`app/index.tsx`) and gameplay route (`app/game/[saveSlotId].tsx`).
- [x] `GameRuntime` lifecycle (`create`, `start`, `pause`, `resume`, `stop`, `dispose`).
- [x] Fixed-step 60 FPS simulation loop with frame delta accumulator and catch-up capping (`GameLoop.ts`).
- [x] Bundled authored map `village_outskirts.json` (30×20 tiles, ground & decoration layers) parsed via `TileMapParser.ts`.
- [x] Camera follow model (`Camera.ts`) clamped to world boundaries with viewport culling (`CameraRenderer.ts`).
- [x] Read-only Skia game canvas (`GameCanvas.tsx`) projecting map and hero sprite.
- [x] Top HUD (Health bar, map title, coordinates) and touch directional controls.
- [x] Pause modal that suspends simulation ticks with play stats.

### Phase 3 — Combat & Enemy AI
- [x] Attack state machine (`startupMs`, `activeMs`, `recoveryMs`) and directional hitboxes (`CombatRules.ts`).
- [x] Damage formula with defense reduction, knockback vectors, and invulnerability frames.
- [x] Enemy AI finite-state machine (`idle`, `chase`, `attack`, `hurt`, `dead`) in `EnemyAIRules.ts`.
- [x] Solid tile collision grid with wall-sliding movement (`CollisionGrid.ts`).
- [x] Domain events: `PLAYER_DAMAGED`, `ENEMY_DAMAGED`, `ENEMY_DEFEATED`, `PLAYER_DIED`, `PLAYER_RESPAWNED`.
- [x] Skia visual combat feedback: sword slash arc, enemy health bars, hurt flashes, defeated markers.
- [x] Dedicated touch attack button and Game Over / Respawn modal.
- [x] 39 unit and integration tests passing across all domain systems.
