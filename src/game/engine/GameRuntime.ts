import { TouchInputAdapter } from '../../input/TouchInputAdapter';
import { RenderProjection } from '../application/GameProjection';
import {
  PlayerEntity,
  createPlayerEntity,
  updatePlayerTransform,
} from '../domain/entities/PlayerEntity';
import { applyMovementStep } from '../domain/rules/MovementRules';
import { createVector2 } from '../domain/value-objects/Vector2';
import { Camera } from '../world/Camera';
import { MapDefinition } from '../world/MapDefinition';
import { GameLoop } from './GameLoop';
import { GameSession } from './GameSession';

export type ProjectionListener = (projection: RenderProjection) => void;

export class GameRuntime {
  private session: GameSession;
  private loop: GameLoop;
  private inputAdapter: TouchInputAdapter;
  private listeners = new Set<ProjectionListener>();
  private isDisposed = false;

  constructor(
    saveSlotId: string,
    map: MapDefinition,
    viewportWidth: number,
    viewportHeight: number
  ) {
    const worldWidth = map.widthInTiles * map.tileSize;
    const worldHeight = map.heightInTiles * map.tileSize;

    const initialSpawn = createVector2(map.spawnPoint.x, map.spawnPoint.y);
    const player = createPlayerEntity('hero_player', initialSpawn, 'down');

    const camera = new Camera(
      {
        viewportWidth,
        viewportHeight,
        worldWidth,
        worldHeight,
      },
      initialSpawn
    );

    this.session = {
      saveSlotId,
      map,
      player,
      camera,
      elapsedTimeSeconds: 0,
      isPaused: false,
    };

    this.inputAdapter = new TouchInputAdapter();

    this.loop = new GameLoop({
      onFixedUpdate: (deltaSeconds) => this.fixedUpdate(deltaSeconds),
      onRender: () => this.publishProjection(),
    });
  }

  get input(): TouchInputAdapter {
    return this.inputAdapter;
  }

  get isRunning(): boolean {
    return this.loop.running;
  }

  get isPaused(): boolean {
    return this.session.isPaused;
  }

  get currentSession(): Readonly<GameSession> {
    return this.session;
  }

  setViewportDimensions(width: number, height: number): void {
    if (this.isDisposed) return;
    this.session.camera.setDimensions(width, height);
    this.publishProjection();
  }

  start(scheduler?: (cb: (timeMs: number) => void) => number): void {
    if (this.isDisposed) return;
    this.session.isPaused = false;
    this.loop.start(scheduler);
  }

  pause(): void {
    if (this.isDisposed) return;
    this.session.isPaused = true;
    this.loop.pause();
    this.publishProjection();
  }

  resume(): void {
    if (this.isDisposed) return;
    this.session.isPaused = false;
    this.loop.resume();
    this.publishProjection();
  }

  stop(canceller?: (id: number) => void): void {
    if (this.isDisposed) return;
    this.loop.stop(canceller);
    this.inputAdapter.reset();
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.stop();
    this.listeners.clear();
    this.isDisposed = true;
  }

  subscribe(listener: ProjectionListener): () => void {
    this.listeners.add(listener);
    // Send immediate initial projection
    listener(this.createProjection());
    return () => {
      this.listeners.delete(listener);
    };
  }

  createProjection(): RenderProjection {
    return Object.freeze({
      player: {
        position: this.session.player.transform.position,
        facing: this.session.player.transform.facing,
        currentHealth: this.session.player.currentHealth,
        maxHealth: this.session.player.stats.maxHealth,
      },
      camera: {
        position: this.session.camera.position,
        viewportWidth: this.session.camera.viewportWidth,
        viewportHeight: this.session.camera.viewportHeight,
      },
      map: this.session.map,
      stats: {
        isPaused: this.session.isPaused,
        stepCount: this.loop.steps,
        elapsedTimeSeconds: this.session.elapsedTimeSeconds,
      },
    });
  }

  /**
   * Deterministic fixed update step.
   */
  fixedUpdate(deltaSeconds: number): void {
    if (this.session.isPaused || this.isDisposed) return;

    const inputSnapshot = this.inputAdapter.readSnapshot();
    const map = this.session.map;
    const worldWidth = map.widthInTiles * map.tileSize;
    const worldHeight = map.heightInTiles * map.tileSize;

    // Movement resolution using pure domain rules
    const newTransform = applyMovementStep({
      currentTransform: this.session.player.transform,
      inputVector: inputSnapshot.moveVector,
      speedUnitsPerSecond: this.session.player.stats.moveSpeed,
      deltaSeconds,
      bounds: {
        minX: map.tileSize / 2,
        minY: map.tileSize / 2,
        maxX: worldWidth - map.tileSize / 2,
        maxY: worldHeight - map.tileSize / 2,
      },
    });

    this.session.player = updatePlayerTransform(this.session.player, newTransform);
    this.session.camera.followTarget(newTransform.position);
    this.session.elapsedTimeSeconds += deltaSeconds;
  }

  private publishProjection(): void {
    if (this.listeners.size === 0 || this.isDisposed) return;
    const proj = this.createProjection();
    for (const listener of this.listeners) {
      listener(proj);
    }
  }
}
