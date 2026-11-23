import { getItemDefinition } from '../content/definitions/items';
import { validateSaveSnapshot } from '../application/SaveSnapshotValidator';
import { CURRENT_SAVE_VERSION, SaveSnapshot } from '../domain/repositories/SaveRepository';
import { TouchInputAdapter } from '../../input/TouchInputAdapter';
import {
  EnemyRenderItem,
  PickupRenderItem,
  RenderProjection,
  UiProjection,
} from '../application/GameProjection';
import {
  EnemyEntity,
  createEnemyEntity,
  updateEnemy,
} from '../domain/entities/EnemyEntity';
import { PickupEntity } from '../domain/entities/PickupEntity';
import {
  PlayerAnimation,
  PlayerEntity,
  createPlayerEntity,
  recalculatePlayerStats,
  updatePlayerAnimation,
  updatePlayerTransform,
} from '../domain/entities/PlayerEntity';
import { EquipmentSlot } from '../domain/items/ItemTypes';
import {
  DEFAULT_ENEMY_ATTACK,
  DEFAULT_PLAYER_ATTACK,
  calculateAttackHitbox,
  calculateDamage,
  calculateKnockbackPosition,
  isTargetInsideHitbox,
} from '../domain/rules/CombatRules';
import { applyConsumableEffect } from '../domain/rules/ConsumableRules';
import { updateEnemyAI } from '../domain/rules/EnemyAIRules';
import { equipItem, unequipItem } from '../domain/rules/EquipmentRules';
import { addItemToInventory, removeItemFromInventory } from '../domain/rules/InventoryRules';
import { canCollectPickup, rollLoot } from '../domain/rules/LootRules';
import { applyMovementStep } from '../domain/rules/MovementRules';
import { addExperience, getCumulativeXpForLevel } from '../domain/rules/ProgressionRules';
import { Direction, createTransform } from '../domain/value-objects/Transform';
import { Vector2, createVector2, scaleVector } from '../domain/value-objects/Vector2';
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
  private latestNotification: string | null = null;

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

    const pickups = new Map<string, PickupEntity>();

    this.session = {
      saveSlotId,
      map,
      collisionGrid,
      player,
      enemies,
      pickups,
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
    this.inputAdapter.reset();
    this.loop.pause();
    this.publishRender();
    this.publishUi(true);
  }

  resume(): void {
    if (this.isDisposed) return;
    this.session.isPaused = false;
    this.loop.resume();
    this.publishRender();
    this.publishUi(true);
  }

  stop(): void {
    if (this.isDisposed) return;
    this.loop.stop();
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.stop();
    this.renderListeners.clear();
    this.uiListeners.clear();
    this.isDisposed = true;
  }

  subscribe(listener: ProjectionListener): () => void {
    this.renderListeners.add(listener);
    listener(this.createProjection());
    return () => {
      this.renderListeners.delete(listener);
    };
  }

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
    this.publishUi(true);
  }

  setPlayerPositionAndFacing(position: Vector2, facing: Direction = 'down'): void {
    this.session.player = updatePlayerTransform(
      this.session.player,
      createTransform(position, facing)
    );
    this.session.camera.followTarget(position);
    this.publishRender();
    this.publishUi(true);
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
    this.session.pickups.clear();
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

  createSaveSnapshot(): SaveSnapshot {
    return Object.freeze({
      version: CURRENT_SAVE_VERSION,
      slotId: this.session.saveSlotId,
      playTimeSeconds: Math.floor(this.session.elapsedTimeSeconds),
      mapId: this.session.map.id,
      player: {
        level: this.session.player.level,
        experience: this.session.player.experience,
        currentHealth: this.session.player.currentHealth,
        maxHealth: this.session.player.derivedStats.maxHealth,
        position: createVector2(
          this.session.player.transform.position.x,
          this.session.player.transform.position.y
        ),
        facing: this.session.player.transform.facing,
      },
      inventory: this.session.player.inventory,
      equipment: this.session.player.equipment,
      worldFlags: {},
      questState: {},
      timestamp: new Date().toISOString(),
    });
  }

  loadFromSnapshot(snapshot: SaveSnapshot): void {
    const validation = validateSaveSnapshot(snapshot);
    if (!validation.valid) {
      throw new Error(`Cannot load corrupted save: ${validation.errors.join('; ')}`);
    }

    const loadedPosition = createVector2(snapshot.player.position.x, snapshot.player.position.y);
    const loadedFacing = snapshot.player.facing;

    let loadedPlayer = createPlayerEntity(
      'hero_player',
      loadedPosition,
      loadedFacing,
      undefined,
      'idle',
      snapshot.player.level,
      snapshot.player.experience
    );

    loadedPlayer = {
      ...loadedPlayer,
      inventory: snapshot.inventory,
      equipment: snapshot.equipment,
      currentHealth: snapshot.player.currentHealth,
    };
    loadedPlayer = recalculatePlayerStats(loadedPlayer, getItemDefinition);

    this.session.player = loadedPlayer;
    this.session.elapsedTimeSeconds = snapshot.playTimeSeconds;
    this.session.camera.followTarget(loadedPosition);
    this.cachedProjection = null;
    this.publishRender();
    this.publishUi(true);
  }

  useItem(slotIndex: number): { success: boolean; reason?: string } {
    if (this.session.player.currentHealth <= 0 || this.isDisposed) {
      return { success: false, reason: 'Cannot use items while defeated' };
    }

    const slot = this.session.player.inventory[slotIndex];
    if (!slot || !slot.item) {
      return { success: false, reason: 'Slot is empty' };
    }

    const result = applyConsumableEffect(
      slot.item,
      this.session.player.currentHealth,
      this.session.player.derivedStats.maxHealth,
      getItemDefinition
    );

    if (!result.success) {
      return { success: false, reason: result.reason };
    }

    const removeResult = removeItemFromInventory(this.session.player.inventory, slotIndex, 1);
    this.session.player = {
      ...this.session.player,
      currentHealth: result.newHealth,
      inventory: removeResult.updatedInventory,
    };

    this.latestNotification = result.effectMessage;
    this.session.eventQueue.push({
      type: 'ITEM_USED',
      itemId: slot.item.itemId,
      effectMessage: result.effectMessage,
    });

    this.publishUi(true);
    return { success: true };
  }

  equipItem(slotIndex: number): { success: boolean; error?: string } {
    if (this.session.player.currentHealth <= 0 || this.isDisposed) {
      return { success: false, error: 'Cannot change equipment while defeated' };
    }

    const slot = this.session.player.inventory[slotIndex];
    if (!slot || !slot.item) {
      return { success: false, error: 'Slot is empty' };
    }

    const equipResult = equipItem(
      this.session.player.inventory,
      this.session.player.equipment,
      slotIndex,
      getItemDefinition
    );

    if (!equipResult.success) {
      return { success: false, error: equipResult.error };
    }

    let updatedPlayer: PlayerEntity = {
      ...this.session.player,
      inventory: equipResult.updatedInventory,
      equipment: equipResult.updatedEquipment,
    };
    updatedPlayer = recalculatePlayerStats(updatedPlayer, getItemDefinition);
    this.session.player = updatedPlayer;

    const itemDef = getItemDefinition(slot.item.itemId);
    this.latestNotification = `Equipped ${itemDef?.name ?? slot.item.itemId}`;
    if (itemDef?.slot) {
      this.session.eventQueue.push({
        type: 'ITEM_EQUIPPED',
        itemId: slot.item.itemId,
        slot: itemDef.slot,
      });
    }

    this.publishUi(true);
    return { success: true };
  }

  unequipItem(slot: EquipmentSlot): { success: boolean; error?: string } {
    if (this.session.player.currentHealth <= 0 || this.isDisposed) {
      return { success: false, error: 'Cannot change equipment while defeated' };
    }

    const equippedItem = this.session.player.equipment[slot];
    if (!equippedItem) {
      return { success: false, error: `No item equipped in ${slot}` };
    }

    const unequipResult = unequipItem(
      this.session.player.inventory,
      this.session.player.equipment,
      slot
    );

    if (!unequipResult.success) {
      return { success: false, error: unequipResult.error };
    }

    let updatedPlayer: PlayerEntity = {
      ...this.session.player,
      inventory: unequipResult.updatedInventory,
      equipment: unequipResult.updatedEquipment,
    };
    updatedPlayer = recalculatePlayerStats(updatedPlayer, getItemDefinition);
    this.session.player = updatedPlayer;

    const itemDef = getItemDefinition(equippedItem.itemId);
    this.latestNotification = `Unequipped ${itemDef?.name ?? equippedItem.itemId}`;
    this.session.eventQueue.push({
      type: 'ITEM_UNEQUIPPED',
      itemId: equippedItem.itemId,
      slot,
    });

    this.publishUi(true);
    return { success: true };
  }

  clearNotification(): void {
    this.latestNotification = null;
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

    const pickupList: PickupRenderItem[] = [];
    for (const pickup of this.session.pickups.values()) {
      pickupList.push({
        id: pickup.id,
        itemId: pickup.itemId,
        position: pickup.position,
        quantity: pickup.quantity,
      });
    }

    const nowMs = this.session.elapsedTimeSeconds * 1000;

    return Object.freeze({
      player: {
        position: this.session.player.transform.position,
        facing: this.session.player.transform.facing,
        currentHealth: this.session.player.currentHealth,
        maxHealth: this.session.player.derivedStats.maxHealth,
        animation: this.session.player.animation,
        isAttacking: this.session.playerAttackTimerMs > 0,
        isInvulnerable: nowMs < this.session.playerInvulnerableUntilMs,
        isDead: this.session.player.currentHealth <= 0,
        level: this.session.player.level,
      },
      enemies: Object.freeze(enemyList),
      pickups: Object.freeze(pickupList),
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

    const nextLevelBaseXp = getCumulativeXpForLevel(this.session.player.level + 1);
    const currentLevelBaseXp = getCumulativeXpForLevel(this.session.player.level);
    const xpRequired = nextLevelBaseXp - currentLevelBaseXp;
    const currentXp = this.session.player.experience - currentLevelBaseXp;

    return Object.freeze({
      playerHealth: this.session.player.currentHealth,
      playerMaxHealth: this.session.player.derivedStats.maxHealth,
      playerCoords: this.session.player.transform.position,
      playerFacing: this.session.player.transform.facing,
      playerLevel: this.session.player.level,
      playerExperience: currentXp,
      playerXpToNextLevel: xpRequired,
      derivedStats: this.session.player.derivedStats,
      inventory: this.session.player.inventory,
      equipment: this.session.player.equipment,
      isDead: this.session.player.currentHealth <= 0,
      isPaused: this.session.isPaused,
      mapName: this.session.map.name,
      aliveEnemyCount: aliveCount,
      totalSteps: this.loop.steps,
      elapsedTimeSeconds: this.session.elapsedTimeSeconds,
      notificationMessage: this.latestNotification,
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
        speedUnitsPerSecond: this.session.player.derivedStats.moveSpeed,
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

    // 2b. Pickup collection
    for (const [pickupId, pickup] of this.session.pickups.entries()) {
      if (canCollectPickup(this.session.player.transform.position, pickup)) {
        const addResult = addItemToInventory(
          this.session.player.inventory,
          { itemId: pickup.itemId, quantity: pickup.quantity },
          getItemDefinition
        );
        if (addResult.success && addResult.remainingQuantity === 0) {
          this.session.player = {
            ...this.session.player,
            inventory: addResult.updatedInventory,
          };
          this.session.pickups.delete(pickupId);
          const itemDef = getItemDefinition(pickup.itemId);
          this.latestNotification = `Collected ${itemDef?.name ?? pickup.itemId}`;
          this.session.eventQueue.push({
            type: 'ITEM_COLLECTED',
            pickupId,
            itemId: pickup.itemId,
            quantity: pickup.quantity,
          });
          this.publishUi(true);
        }
      }
    }

    // 3. Process Player Attack Timer & Hit Window
    if (this.session.playerAttackTimerMs > 0) {
      this.session.playerAttackTimerMs -= deltaMs;

      const timeElapsedInAttack =
        DEFAULT_PLAYER_ATTACK.startupMs +
        DEFAULT_PLAYER_ATTACK.activeMs +
        DEFAULT_PLAYER_ATTACK.recoveryMs -
        this.session.playerAttackTimerMs;

      const isInActiveWindow =
        timeElapsedInAttack >= DEFAULT_PLAYER_ATTACK.startupMs &&
        timeElapsedInAttack <=
          DEFAULT_PLAYER_ATTACK.startupMs + DEFAULT_PLAYER_ATTACK.activeMs;

      if (isInActiveWindow && !this.hasProcessedPlayerAttackHit) {
        this.executePlayerAttackHit(nowMs);
        this.hasProcessedPlayerAttackHit = true;
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

    // 4. Update Enemy AI and Combat
    const playerPosition = this.session.player.transform.position;
    for (const [id, enemy] of this.session.enemies.entries()) {
      const aiResult = updateEnemyAI(enemy, playerPosition, deltaSeconds);
      let updatedEnemy = aiResult.updatedEnemy;

      // Enemy movement with wall-sliding
      if (aiResult.intendedMovement) {
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
          this.session.player.derivedStats.attack,
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

        let updated = updateEnemy(enemy, {
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

          // Award XP and spawn loot ONLY ONCE per enemy
          if (!enemy.xpAwarded) {
            updated = updateEnemy(updated, { xpAwarded: true });
            this.session.enemies.set(id, updated);

            // Award XP
            const xpResult = addExperience(
              this.session.player.level,
              this.session.player.experience,
              enemy.stats.xpReward
            );

            let updatedPlayer: PlayerEntity = {
              ...this.session.player,
              level: xpResult.newLevel,
              experience: xpResult.totalXp,
            };
            updatedPlayer = recalculatePlayerStats(updatedPlayer, getItemDefinition);

            if (xpResult.didLevelUp) {
              updatedPlayer = {
                ...updatedPlayer,
                currentHealth: updatedPlayer.derivedStats.maxHealth,
              };
              this.session.eventQueue.push({
                type: 'LEVEL_UP',
                oldLevel: xpResult.oldLevel,
                newLevel: xpResult.newLevel,
                statBonus: xpResult.statBonus,
              });
              this.latestNotification = `Level Up! Reached Level ${xpResult.newLevel}`;
            }

            this.session.player = updatedPlayer;

            // Spawn loot pickups
            const drops = rollLoot(enemy.enemyType, enemy.transform.position);
            for (const drop of drops) {
              this.session.pickups.set(drop.id, drop);
              this.session.eventQueue.push({
                type: 'ITEM_DROPPED',
                pickupId: drop.id,
                itemId: drop.itemId,
                quantity: drop.quantity,
                position: drop.position,
              });
            }
          }
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
        this.session.player.derivedStats.defense,
        DEFAULT_ENEMY_ATTACK.damageMultiplier
      );

      const newHealth = Math.max(0, this.session.player.currentHealth - damage);
      this.session.playerInvulnerableUntilMs = nowMs + 500;

      // Apply knockback to player
      const knockbackPos = calculateKnockbackPosition(
        enemy.transform.position,
        this.session.player.transform.position,
        DEFAULT_ENEMY_ATTACK.knockback
      );
      const resolvedKnockback = this.session.collisionGrid.resolveMovement(
        this.session.player.transform.position,
        createVector2(knockbackPos.x - this.session.player.transform.position.x, knockbackPos.y - this.session.player.transform.position.y)
      );

      const isDead = newHealth <= 0;
      this.session.player = {
        ...this.session.player,
        currentHealth: newHealth,
        animation: {
          state: isDead ? 'dead' : 'hurt',
          frame: 0,
          timerMs: 0,
        },
        transform: createTransform(resolvedKnockback, this.session.player.transform.facing),
      };

      this.session.eventQueue.push({
        type: 'PLAYER_DAMAGED',
        amount: damage,
        sourceId: enemy.id,
      });

      if (isDead) {
        this.session.eventQueue.push({ type: 'PLAYER_DIED' });
      }

      this.publishUi(true); // Immediate UI update on player damage
    }
  }

  private publishRender(): void {
    if (this.renderListeners.size === 0) return;
    const proj = this.createProjection();
    for (const listener of this.renderListeners) {
      listener(proj);
    }
  }

  private publishUi(immediate = false): void {
    if (this.uiListeners.size === 0) return;
    const nowMs = this.session.elapsedTimeSeconds * 1000;
    const ui = this.createUiProjection();

    for (const entry of this.uiListeners) {
      if (immediate || nowMs - this.lastUiPublishMs >= entry.intervalMs) {
        entry.listener(ui);
      }
    }
    this.lastUiPublishMs = nowMs;
  }
}
