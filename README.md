# Dungeonbound: The Lost Realm

> **Status:** Phase 0 (Project Foundation & Technical Spike) complete.

Dungeonbound is an **offline-first, single-player 2D top-down action RPG** for mobile. The player explores an interconnected fantasy realm, accepts quests in a safe village hub, descends into dungeons, fights enemies, collects loot, and returns stronger.

The game is built with **React Native + Expo SDK 58 + TypeScript + React Native Skia + Expo SQLite**. It requires no network connection to boot, render, move, or save.

---

## Technical Stack & Architecture

| Layer | Technology | Purpose |
| --- | --- | --- |
| Framework | Expo SDK 58 / React Native 0.88 / React 19.3 | Cross-platform mobile foundation (Android-first) |
| Language | TypeScript (`strict: true`) | Safe contracts, domain encapsulation |
| Rendering | `@shopify/react-native-skia` | 2D canvas, tile layers, sprites, effects |
| Navigation | Expo Router | Application screens, HUD, modals |
| Persistence | `expo-sqlite` (WAL mode) | Durable save snapshots, offline progress |
| Domain Tests | Jest + `jest-expo` | Unit tests for pure rules (movement, combat, math) |

### Layer Boundaries

- `app/`: Expo Router routes and application screens.
- `src/ui/`: UI components, menus, touch controls, HUD.
- `src/game/domain/`: Pure domain types, value objects, rules (0 imports from React, Skia, Expo, SQLite).
- `src/game/engine/`: Game loop, session lifecycle, update scheduler.
- `src/game/systems/`: Movement, collision, AI, combat, loot, quests.
- `src/game/world/`: Maps, tile parser, collision grid, camera.
- `src/rendering/`: Skia canvas and scene renderers (read-only view).
- `src/input/`: Touch adapter and virtual controls.
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

## Phase 0 Technical Spike Deliverables

- [x] Scaffolding with Expo SDK 58, React Native 0.88, React 19.3, TypeScript in strict mode.
- [x] Landscape orientation locked in `app.json`.
- [x] Expo Router layout and entry point.
- [x] `@shopify/react-native-skia` 2D canvas rendering dungeon tile grid and placeholder player character.
- [x] `expo-sqlite` database initialization with WAL mode, schema migrations table, and persistence probe.
- [x] Pure domain modules (`Vector2` and `MovementRules`) with 14 passing unit tests.
- [x] Path aliases configured (`@/*` -> `./src/*`).
- [x] Metro bundler Android export verified without errors.
- [x] 100% offline verification: no network calls required.
