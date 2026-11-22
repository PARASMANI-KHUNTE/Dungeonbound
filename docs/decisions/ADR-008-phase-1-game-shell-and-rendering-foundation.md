# ADR-008: Phase 1 Game Shell and Rendering Foundation

## Status
Accepted

## Context
Following Phase 0, Dungeonbound requires establishing the active game runtime lifecycle, fixed-step game loop, smooth camera follow model, bundled tile map parser, and responsive Skia 2D rendering without frame-by-frame React state reconciliation.

## Decisions

1. **Fixed-Step Simulation Loop (`GameLoop`)**:
   - Fixed delta step of $1/60$ seconds (16.667ms).
   - Accumulated elapsed time pattern with frame delta clamped to `maxFrameDeltaSeconds = 0.1` (100ms) to prevent simulation explosions after app suspension.
   - Capped catch-up steps (`maxCatchUpSteps = 5`) to prevent spiral of death on lower-end devices.
   - Clean pause/resume lifecycle resets timestamp baseline so resuming does not trigger an accumulator spike.

2. **Game Runtime Lifecycle (`GameRuntime`)**:
   - Encapsulates `GameSession`, `GameLoop`, `TouchInputAdapter`, and `Camera`.
   - Explicit lifecycle methods: `start()`, `pause()`, `resume()`, `stop()`, `dispose()`.
   - Decoupled from React: simulation executes internally on fixed steps; exposes a subscription mechanism for `RenderProjection` updates.

3. **Data-Driven Map & Camera Follow**:
   - Authored bundled map `village_outskirts.json` (30×20 tiles at 32px tileSize = 960×640 world units).
   - Validated at load time by `TileMapParser`.
   - Camera centers on the player and clamps to map edges so the camera never displays void space outside the world.
   - Viewport culling in `CameraRenderer` calculates visible tile row/col ranges with 1-tile padding.

4. **Read-Only Skia Canvas (`GameCanvas`)**:
   - Purely projects the `RenderProjection`.
   - Translates world coordinates to screen space using camera offsets.
   - Renders ground and decoration tile layers, player shadow, hero body, crest, and directional facing indicator.

5. **Screen & Lifecycle Navigation**:
   - Main menu route (`/`) transitions to gameplay route (`/game/[saveSlotId]`).
   - AppState listener automatically pauses runtime on background/inactive state.
   - Pause modal cleanly suspends simulation updates while displaying game statistics.
