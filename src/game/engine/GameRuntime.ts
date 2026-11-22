import { TouchInputAdapter } from '../../input/TouchInputAdapter';
import {
  EnemyRenderItem,
  RenderProjection,
  UiProjection,
} from '../application/GameProjection';
import {
  EnemyEntity,
  createEnemyEntity,
  updateEnemy,
} from '../domain/entities/EnemyEntity';
import {
  PlayerAnimation,
  PlayerEntity,
  createPlayerEntity,
  updatePlayerAnimation,
  updatePlayerTransform,
} from '../domain/entities/PlayerEntity';
import { DomainEvent } from '../domain/events/DomainEvents';
import {
  DEFAULT_ENEMY_ATTACK,
  DEFAULT_PLAYER_ATTACK,
  calculateAttackHitbox,
  calculateDamage,
  calculateKnockbackPosition,
  isTargetInsideHitbox,
} from '../domain/rules/CombatRules';
import { updateEnemyAI } from '../domain/rules/EnemyAIRules';
import { applyMovementStep } from '../domain/rules/MovementRules';
import { createTransform } from '../domain/value-objects/Transform';
import { createVector2, scaleVector } from '../domain/value-objects/Vector2';
import { Camera } from '../world/Camera';
import { CollisionGrid } from '../world/CollisionGrid';
import { MapDefinition } from '../world/MapDefinition';
import { GameLoop } from './GameLoop';
import { GameSession } from './GameSession';

export type ProjectionListener = (projection: RenderProjection) => void;
export type UiListener = (ui: UiProjection) => void;

export const WALK_FRAME_DURATION_MS = 120;
export const UI_THROTTLE_INTERVAL_MS = 100; // 10 Hz controlled cadence for React HUD

export class GameRuntime {
  private session: GameSession;
  private loop: GameLoop;
  private inputAdapter: TouchInputAdapter;
  private renderListeners = new Set<ProjectionListener>();
  private uiListeners = new Set<{ listener: UiListener; intervalMs: number }>();
  private isDisposed = false;
  private hasProcessedPlayerAttackHit = false;
  private lastUiPublishMs = 0;
  private cachedProjection: RenderProjection | null = null;

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

    const collisionGrid = new CollisionGrid(map);

    // Initial enemies placed on the map
    const enemies = new Map<string, EnemyEntity>();
    enemies.set(
      'goblin_1',
      createEnemyEntity('goblin_1', 'goblin_scout', createVector2(260, 220), 'down')
    );
    enemies.set(
      'goblin_2',
      createEnemyEntity('goblin_2', 'goblin_scout', createVector2(680, 220), 'down')
    );
    enemies.set(
      'goblin_3',
      createEnemyEntity('goblin_3', 'goblin_scout', createVector2(320, 480), 'up')
    );

    this.session = {
      saveSlotId,
      map,
      collisionGrid,
      player,
      enemies,
      camera,
      respawnPoint: initialSpawn,
      playerAttackTimerMs: 0,
      playerAttackCooldownMs: 0,
      playerInvulnerableUntilMs: 0,
      elapsedTimeSeconds: 0,
      isPaused: false,
      eventQueue: [],
    };

    this.inputAdapter = new TouchInputAdapter();

    this.loop = new GameLoop({
      onFixedUpdate: (deltaSeconds) => this.fixedUpdate(deltaSeconds),
      onRender: () => this.publishRender(),
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
    this.cachedProjection = null;
    this.publishRender();
  }

  start(scheduler?: (cb: (timeMs: number) => void) => number): void {
    if (this.isDisposed) return;
    this.session.isPaused = false;
    this.loop.start(scheduler);
    this.publishUi(true);
  }

  pause(): void {
    if (this.isDisposed) return;
    this.session.isPaused = true;
    this.loop.pause();
    this.publishRender();
    this.publishUi(true); // Immediate UI update on pause
  }

  resume(): void {
    if (this.isDisposed) return;
    this.session.isPaused = false;
    this.loop.resume();
    this.publishRender();
    this.publishUi(true); // Immediate UI update on resume
  }

  stop(canceller?: (id: number) => void): void {
    if (this.isDisposed) return;
    this.loop.stop(canceller);
    this.inputAdapter.reset();
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.stop();
    this.renderListeners.clear();
    this.uiListeners.clear();
    this.isDisposed = true;
  }

  /**
   * High-frequency render projection subscription for canvas redraws.
   */
  subscribe(listener: ProjectionListener): () => void {
    this.renderListeners.add(listener);
    listener(this.createProjection());
    return () => {
      this.renderListeners.delete(listener);
    };
  }

  /**
   * Controlled cadence UI-only subscription for React HUD components.
   * Prevents per-frame React setState updates by throttling.
   */
  subscribeUI(listener: UiListener, intervalMs = UI_THROTTLE_INTERVAL_MS): () => void {
    const entry = { listener, intervalMs };
    this.uiListeners.add(entry);
    listener(this.createUiProjection());
    return () => {
      this.uiListeners.delete(entry);
    };
  }

  triggerPlayerAttack(): boolean {
    if (
      this.session.isPaused ||
      this.isDisposed ||
      this.session.player.currentHealth <= 0 ||
      this.session.playerAttackCooldownMs > 0 ||
      this.session.playerAttackTimerMs > 0
    ) {
      return false;
    }

    this.session.playerAttackTimerMs =
      DEFAULT_PLAYER_ATTACK.startupMs +
      DEFAULT_PLAYER_ATTACK.activeMs +
      DEFAULT_PLAYER_ATTACK.recoveryMs;
    this.hasProcessedPlayerAttackHit = false;

    this.session.player = updatePlayerAnimation(this.session.player, {
      state: 'attack',
      frame: 0,
      timerMs: 0,
    });

    return true;
  }

  damagePlayer(amount: number, sourceId?: string): void {
    const newHealth = Math.max(0, this.session.player.currentHealth - amount);
    this.session.player = {
      ...this.session.player,
      currentHealth: newHealth,
      animation: newHealth <= 0 ? { state: 'dead', frame: 0, timerMs: 0 } : this.session.player.animation,
    };
    this.session.eventQueue.push({ type: 'PLAYER_DAMAGED', amount, sourceId });
    if (newHealth <= 0) {
      this.session.eventQueue.push({ type: 'PLAYER_DIED' });
    }
    this.publishUi(true); // Immediate update on damage
  }

  respawnPlayer(): void {
    if (this.isDisposed) return;
    const respawnPos = this.session.respawnPoint;
    const resetPlayer = createPlayerEntity('hero_player', respawnPos, 'down');

    // Reset enemies
    const resetEnemies = new Map<string, EnemyEntity>();
    resetEnemies.set(
      'goblin_1',
      createEnemyEntity('goblin_1', 'goblin_scout', createVector2(260, 220), 'down')
    );
    resetEnemies.set(
      'goblin_2',
      createEnemyEntity('goblin_2', 'goblin_scout', createVector2(680, 220), 'down')
    );
    resetEnemies.set(
      'goblin_3',
      createEnemyEntity('goblin_3', 'goblin_scout', createVector2(320, 480), 'up')
    );

    this.session.player = resetPlayer;
    this.session.enemies = resetEnemies;
    this.session.playerAttackTimerMs = 0;
    this.session.playerAttackCooldownMs = 0;
    this.session.playerInvulnerableUntilMs = 0;
    this.session.camera.followTarget(respawnPos);
    this.session.eventQueue.push({ type: 'PLAYER_RESPAWNED', position: respawnPos });

    this.cachedProjection = null;
    if (this.session.isPaused) {
      this.resume();
    } else {
      this.publishRender();
      this.publishUi(true);
    }
  }

  createProjection(): RenderProjection {
    const enemyList: EnemyRenderItem[] = [];
    for (const enemy of this.session.enemies.values()) {
      enemyList.push({
        id: enemy.id,
        enemyType: enemy.enemyType,
        position: enemy.transform.position,
        facing: enemy.transform.facing,
        currentHealth: enemy.currentHealth,
        maxHealth: enemy.stats.maxHealth,
        state: enemy.state,
      });
    }

    const nowMs = this.session.elapsedTimeSeconds * 1000;

    return Object.freeze({
      player: {
        position: this.session.player.transform.position,
        facing: this.session.player.transform.facing,
        currentHealth: this.session.player.currentHealth,
        maxHealth: this.session.player.stats.maxHealth,
        animation: this.session.player.animation,
        isAttacking: this.session.playerAttackTimerMs > 0,
        isInvulnerable: nowMs < this.session.playerInvulnerableUntilMs,
        isDead: this.session.player.currentHealth <= 0,
      },
      enemies: Object.freeze(enemyList),
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
      recentEvents: Object.freeze([...this.session.eventQueue]),
    });
  }

  createUiProjection(): UiProjection {
    let aliveCount = 0;
    for (const enemy of this.session.enemies.values()) {
      if (enemy.state !== 'dead') aliveCount++;
    }

    return Object.freeze({
      playerHealth: this.session.player.currentHealth,
      playerMaxHealth: this.session.player.stats.maxHealth,
      playerCoords: this.session.player.transform.position,
      playerFacing: this.session.player.transform.facing,
      isDead: this.session.player.currentHealth <= 0,
      isPaused: this.session.isPaused,
      mapName: this.session.map.name,
      aliveEnemyCount: aliveCount,
      totalSteps: this.loop.steps,
      elapsedTimeSeconds: this.session.elapsedTimeSeconds,
    });
  }

  /**
   * Deterministic simulation fixed update step.
   */
  fixedUpdate(deltaSeconds: number): void {
    if (this.session.isPaused || this.isDisposed) return;

    const deltaMs = deltaSeconds * 1000;
    this.session.elapsedTimeSeconds += deltaSeconds;
    const nowMs = this.session.elapsedTimeSeconds * 1000;

    // Check player death
    if (this.session.player.currentHealth <= 0) {
      if (this.session.player.animation.state !== 'dead') {
        this.session.player = updatePlayerAnimation(this.session.player, {
          state: 'dead',
          frame: 0,
          timerMs: 0,
        });
      }
      return;
    }

    // 1. Process discrete player attack commands from input adapter
    const inputSnapshot = this.inputAdapter.readSnapshot();
    if (inputSnapshot.isAttacking) {
      this.triggerPlayerAttack();
    }

    // Advance player attack cooldown
    if (this.session.playerAttackCooldownMs > 0) {
      this.session.playerAttackCooldownMs = Math.max(0, this.session.playerAttackCooldownMs - deltaMs);
    }

    // 2. Resolve Player Movement with solid wall collision & sliding
    const isMoving = inputSnapshot.moveVector.x !== 0 || inputSnapshot.moveVector.y !== 0;

    if (this.session.playerAttackTimerMs <= 0) {
      const intendedTransform = applyMovementStep({
        currentTransform: this.session.player.transform,
        inputVector: inputSnapshot.moveVector,
        speedUnitsPerSecond: this.session.player.stats.moveSpeed,
        deltaSeconds,
      });

      const displacement = createVector2(
        intendedTransform.position.x - this.session.player.transform.position.x,
        intendedTransform.position.y - this.session.player.transform.position.y
      );

      const resolvedPos = this.session.collisionGrid.resolveMovement(
        this.session.player.transform.position,
        displacement,
        10,
        10
      );

      // Update Player Animation State (Walk cycle)
      let newAnim: PlayerAnimation;
      const isInvulnerable = nowMs < this.session.playerInvulnerableUntilMs;

      if (isInvulnerable) {
        newAnim = { state: 'hurt', frame: 0, timerMs: 0 };
      } else if (isMoving) {
        const nextTimer = this.session.player.animation.timerMs + deltaMs;
        const currentFrame = Math.floor(nextTimer / WALK_FRAME_DURATION_MS) % 4;
        newAnim = {
          state: 'walk',
          frame: currentFrame,
          timerMs: nextTimer,
        };
      } else {
        newAnim = { state: 'idle', frame: 0, timerMs: 0 };
      }

      this.session.player = updatePlayerAnimation(
        updatePlayerTransform(
          this.session.player,
          createTransform(resolvedPos, intendedTransform.facing)
        ),
        newAnim
      );
    }

    this.session.camera.followTarget(this.session.player.transform.position);

    // 3. Process Player Attack Timer & Hit Window
    if (this.session.playerAttackTimerMs > 0) {
      this.session.playerAttackTimerMs -= deltaMs;

      const totalDuration =
        DEFAULT_PLAYER_ATTACK.startupMs +
        DEFAULT_PLAYER_ATTACK.activeMs +
        DEFAULT_PLAYER_ATTACK.recoveryMs;
      const elapsedAttackMs = totalDuration - this.session.playerAttackTimerMs;

      // Active hit window check
      if (
        !this.hasProcessedPlayerAttackHit &&
        elapsedAttackMs >= DEFAULT_PLAYER_ATTACK.startupMs &&
        elapsedAttackMs <= DEFAULT_PLAYER_ATTACK.startupMs + DEFAULT_PLAYER_ATTACK.activeMs
      ) {
        this.hasProcessedPlayerAttackHit = true;
        this.executePlayerAttackHit(nowMs);
      }

      if (this.session.playerAttackTimerMs <= 0) {
        this.session.playerAttackTimerMs = 0;
        this.session.playerAttackCooldownMs = DEFAULT_PLAYER_ATTACK.cooldownMs;
        this.session.player = updatePlayerAnimation(this.session.player, {
          state: 'idle',
          frame: 0,
          timerMs: 0,
        });
      }
    }

    // 4. Update Enemies AI, Movement, and Attacks
    for (const [id, enemy] of this.session.enemies.entries()) {
      if (enemy.state === 'dead') continue;

      const aiResult = updateEnemyAI(enemy, this.session.player.transform.position, deltaSeconds);
      let updatedEnemy = aiResult.updatedEnemy;

      // Resolve enemy movement with collision grid
      if (aiResult.intendedMovement.x !== 0 || aiResult.intendedMovement.y !== 0) {
        const displacement = scaleVector(aiResult.intendedMovement, deltaSeconds);
        const resolvedPos = this.session.collisionGrid.resolveMovement(
          updatedEnemy.transform.position,
          displacement,
          10,
          10
        );
        updatedEnemy = updateEnemy(updatedEnemy, {
          transform: createTransform(resolvedPos, updatedEnemy.transform.facing),
        });
      }

      // Enemy attack hit detection on player
      if (aiResult.shouldTriggerAttackHit) {
        this.executeEnemyAttackHit(updatedEnemy, nowMs);
      }

      this.session.enemies.set(id, updatedEnemy);
    }

    // Invalidate cached render projection
    this.cachedProjection = null;

    // Check throttled UI publication
    if (nowMs - this.lastUiPublishMs >= UI_THROTTLE_INTERVAL_MS) {
      this.publishUi(false);
    }
  }

  private executePlayerAttackHit(nowMs: number): void {
    const playerPos = this.session.player.transform.position;
    const playerFacing = this.session.player.transform.facing;
    const hitbox = calculateAttackHitbox(
      playerPos,
      playerFacing,
      DEFAULT_PLAYER_ATTACK.range,
      DEFAULT_PLAYER_ATTACK.hitboxWidth
    );

    for (const [id, enemy] of this.session.enemies.entries()) {
      if (enemy.state === 'dead') continue;

      if (isTargetInsideHitbox(enemy.transform.position, 12, hitbox)) {
        if (nowMs < enemy.invulnerableUntilMs) continue;

        const damage = calculateDamage(
          this.session.player.stats.attack,
          enemy.stats.defense,
          DEFAULT_PLAYER_ATTACK.damageMultiplier
        );

        const newHealth = Math.max(0, enemy.currentHealth - damage);
        const isDead = newHealth <= 0;

        // Apply knockback
        const knockbackPos = calculateKnockbackPosition(
          playerPos,
          enemy.transform.position,
          DEFAULT_PLAYER_ATTACK.knockback
        );
        const resolvedKnockback = this.session.collisionGrid.resolveMovement(
          enemy.transform.position,
          createVector2(knockbackPos.x - enemy.transform.position.x, knockbackPos.y - enemy.transform.position.y)
        );

        const updated = updateEnemy(enemy, {
          currentHealth: newHealth,
          state: isDead ? 'dead' : 'hurt',
          stateTimerMs: 0,
          invulnerableUntilMs: nowMs + 280,
          transform: createTransform(resolvedKnockback, enemy.transform.facing),
        });

        this.session.enemies.set(id, updated);
        this.session.eventQueue.push({
          type: 'ENEMY_DAMAGED',
          enemyId: id,
          amount: damage,
          sourceId: this.session.player.id,
        });

        if (isDead) {
          this.session.eventQueue.push({
            type: 'ENEMY_DEFEATED',
            enemyId: id,
            enemyType: enemy.enemyType,
            xpReward: enemy.stats.xpReward,
          });
        }

        this.publishUi(true); // Immediate UI update on enemy damage/defeat
      }
    }
  }

  private executeEnemyAttackHit(enemy: EnemyEntity, nowMs: number): void {
    if (this.session.player.currentHealth <= 0) return;
    if (nowMs < this.session.playerInvulnerableUntilMs) return;

    const hitbox = calculateAttackHitbox(
      enemy.transform.position,
      enemy.transform.facing,
      DEFAULT_ENEMY_ATTACK.range,
      DEFAULT_ENEMY_ATTACK.hitboxWidth
    );

    if (isTargetInsideHitbox(this.session.player.transform.position, 12, hitbox)) {
      const damage = calculateDamage(
        enemy.stats.attackPower,
        this.session.player.stats.defense,
        DEFAULT_ENEMY_ATTACK.damageMultiplier
      );

      const newHealth = Math.max(0, this.session.player.currentHealth - damage);
      const isDead = newHealth <= 0;

      // Knockback on player
      const knockbackPos = calculateKnockbackPosition(
        enemy.transform.position,
        this.session.player.transform.position,
        DEFAULT_ENEMY_ATTACK.knockback
      );
      const resolvedKnockback = this.session.collisionGrid.resolveMovement(
        this.session.player.transform.position,
        createVector2(
          knockbackPos.x - this.session.player.transform.position.x,
          knockbackPos.y - this.session.player.transform.position.y
        )
      );

      this.session.player = {
        ...this.session.player,
        currentHealth: newHealth,
        transform: createTransform(resolvedKnockback, this.session.player.transform.facing),
        animation: isDead ? { state: 'dead', frame: 0, timerMs: 0 } : { state: 'hurt', frame: 0, timerMs: 0 },
      };

      this.session.playerInvulnerableUntilMs = nowMs + 400; // 400ms i-frame

      this.session.eventQueue.push({
        type: 'PLAYER_DAMAGED',
        amount: damage,
        sourceId: enemy.id,
      });

      if (isDead) {
        this.session.eventQueue.push({ type: 'PLAYER_DIED' });
      }

      this.publishUi(true); // Immediate UI update on player damage/death
    }
  }

  private publishRender(): void {
    if (this.renderListeners.size === 0 || this.isDisposed) return;
    const proj = this.createProjection();
    for (const listener of this.renderListeners) {
      listener(proj);
    }
  }

  private publishUi(force = false): void {
    if (this.uiListeners.size === 0 || this.isDisposed) return;
    const nowMs = this.session.elapsedTimeSeconds * 1000;

    if (!force && nowMs - this.lastUiPublishMs < UI_THROTTLE_INTERVAL_MS) {
      return;
    }

    this.lastUiPublishMs = nowMs;
    const ui = this.createUiProjection();
    for (const { listener } of this.uiListeners) {
      listener(ui);
    }
  }
}
