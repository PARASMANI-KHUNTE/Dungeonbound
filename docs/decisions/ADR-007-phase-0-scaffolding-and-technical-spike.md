# ADR-007: Phase 0 Foundation and Technical Spike Implementation

## Status
Accepted

## Context
Dungeonbound requires an offline-first 2D mobile action RPG architecture built with React Native, Expo, React Native Skia, and Expo SQLite. Before developing gameplay features (combat, enemies, dungeons), Phase 0 requires validating the baseline framework, landscape orientation, pure domain model separation, Skia rendering spike, and durable SQLite persistence.

## Decisions

1. **Expo SDK Baseline**:
   - Selected Expo SDK 58 (`expo@~58.0.26`, `react-native@0.88.1`, `react@19.3.0`).
   - Pinned `react-dom@19.3.0` via npm overrides to maintain peer dependency compatibility with React 19.3.0.
   - Configured landscape orientation (`orientation: "landscape"`) in `app.json`.

2. **Pure Domain Boundary**:
   - Implemented `Vector2` value object and `MovementRules` in `src/game/domain/`.
   - Domain modules have zero dependencies on React Native, Skia, Expo, Zustand, or SQLite.
   - Enforced normalized diagonal movement (preventing diagonal velocity exploitation) and dominant-axis facing direction rules.

3. **Skia Rendering Spike**:
   - Implemented `GameCanvas` using `@shopify/react-native-skia@2.14.0` rendering a multi-layered tile grid, subtle grid lines, and a placeholder character with directional facing indicator.
   - Read-only projection model: rendering visualizes domain state without executing game rules.

4. **Durable SQLite Persistence Probe**:
   - Implemented schema migrations and persistence probe using `expo-sqlite@~58.0.18`.
   - Database operations use parameterized queries and WAL mode.
   - Proved data survives restarts via `spike_persistence_probe` tracking launch counts and boot timestamps.

5. **Quality Gates**:
   - Strict TypeScript (`strict: true`, path alias `@/*`).
   - ESLint flat configuration for code quality.
   - Jest test runner with pure domain unit tests running in Node/Jest.
   - Android Metro bundle export verified.
