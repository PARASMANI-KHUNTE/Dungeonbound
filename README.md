# Dungeonbound: The Lost Realm

> **Status:** Specification / planning stage — the repository currently contains design documents only. No playable app has been scaffolded yet.

Dungeonbound is a planned **offline-first, single-player 2D top-down action RPG** for mobile. The player explores a small interconnected fantasy world, accepts quests in a safe village hub, descends into dungeons, fights enemies, collects loot, and returns stronger.

The first release is intentionally compact and fully playable in airplane mode. Multiplayer is a possible future phase, but it is explicitly out of scope for V1.

## What is in this repository

| File | Purpose |
| --- | --- |
| [`project.md`](project.md) | Product vision, scope, gameplay design, technology stack, architecture (HLD/LLD), phase plan, and acceptance criteria. Treated as the primary project contract. |
| [`coding-agent-prompt.md`](coding-agent-prompt.md) | Working rules and process for AI coding agents implementing the game, including quality gates and phase guidance. |
| [`README.md`](README.md) | This onboarding document. |

## Product vision

- **Offline-first:** no login, backend, or network connection required to play.
- **Game-first:** tight movement, combat feedback, and progression before large content volume.
- **Mobile-native:** landscape orientation, touch controls, pause/resume, and mid-range Android performance.
- **Data-driven content:** maps, items, enemies, quests, and balance live in content data, not UI components.
- **Small vertical slices:** every phase should leave the game in a runnable state.
- **Multiplayer-ready boundaries, not multiplayer implementation:** commands, events, stable entity IDs, and repository interfaces now; no sockets or accounts in V1.

## Planned first playable slice

1. Start in a safe village.
2. Talk to an NPC and accept a quest.
3. Travel to a nearby dungeon entrance.
4. Explore rooms, fight enemies, and collect loot.
5. Defeat a mini-boss and obtain a quest item.
6. Return to the village, turn in the quest, receive rewards, and save progress.

## Planned technology stack

| Layer | Choice |
| --- | --- |
| Framework | React Native + Expo |
| Language | TypeScript (strict mode) |
| Rendering | `@shopify/react-native-skia` |
| Navigation | Expo Router |
| UI state | Zustand (UI/application state only) |
| Persistence | `expo-sqlite` |
| UI animation | `react-native-reanimated` / `react-native-worklets` where needed |
| Content | Tiled JSON maps and bundled local assets |
| Tests | Jest + `jest-expo`, React Native Testing Library |

Exact package versions should follow the Expo SDK selected when implementation begins. See [`project.md`](project.md) for the architecture baseline and dependency guidance.

## Intended architecture

Implementation is planned around these boundaries:

- `app/` — Expo Router routes and app composition
- `src/ui/` — screens, menus, HUD, touch controls
- `src/game/domain/` — pure game types and rules
- `src/game/engine/` — session lifecycle and fixed-step game loop
- `src/game/systems/` — movement, collision, AI, combat, loot, progression, quests
- `src/game/world/` — maps, parser, collision grid, camera
- `src/game/content/` — bundled, validated definitions
- `src/game/application/` — application services and projections
- `src/rendering/` — Skia canvas and scene rendering
- `src/input/` — touch-to-game input adapter
- `src/platform/persistence/` — SQLite database, migrations, repositories
- `src/state/` — Zustand UI-only stores

Gameplay rules must stay independent of React Native UI, rendering, storage, and future networking. Domain code must not import React Native, Expo, Skia, Zustand, or SQLite.

## Roadmap

Development is organized in phases. Phase 0 establishes the project foundation and technical spike: Expo + TypeScript scaffold, landscape orientation, strict lint/typecheck, Expo Router, Skia tile grid with a placeholder player, SQLite persistence proof, and one passing pure-domain unit test. Later phases build a bundled map, camera and lifecycle, combat, enemies, inventory, quests, and the full village-to-dungeon loop.

See [`project.md`](project.md) for the detailed phase gates and acceptance criteria.

## Getting started

This repository currently has no runnable application or build scripts. To understand the project, read:

1. [`project.md`](project.md) — the full specification.
2. [`coding-agent-prompt.md`](coding-agent-prompt.md) — implementation rules for contributors and coding agents.

Once the Expo scaffold is added, setup, run, test, and build instructions will be documented here.

## Contributing

Contributions should follow the architecture and phase guidance in `project.md`, preserve the pure-domain boundaries, and keep TypeScript, lint, and tests healthy. If you are using a coding agent, follow `coding-agent-prompt.md`.

## License

No license has been selected yet. Add one before accepting external contributions.
