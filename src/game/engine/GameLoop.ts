export interface GameLoopCallbacks {
  onFixedUpdate: (deltaSeconds: number) => void;
  onRender: (renderTimeMs: number) => void;
}

export interface GameLoopConfig {
  readonly fixedStepSeconds?: number; // defaults to 1 / 60
  readonly maxFrameDeltaSeconds?: number; // defaults to 0.1 (100ms)
  readonly maxCatchUpSteps?: number; // defaults to 5
}

export class GameLoop {
  readonly fixedStepSeconds: number;
  readonly maxFrameDeltaSeconds: number;
  readonly maxCatchUpSteps: number;

  private callbacks: GameLoopCallbacks;
  private previousTimeMs = 0;
  private accumulator = 0;
  private isRunning = false;
  private isPaused = false;
  private frameId: number | null = null;
  private stepCount = 0;

  constructor(callbacks: GameLoopCallbacks, config?: GameLoopConfig) {
    this.callbacks = callbacks;
    this.fixedStepSeconds = config?.fixedStepSeconds ?? 1 / 60;
    this.maxFrameDeltaSeconds = config?.maxFrameDeltaSeconds ?? 0.1;
    this.maxCatchUpSteps = config?.maxCatchUpSteps ?? 5;
  }

  get running(): boolean {
    return this.isRunning;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  get steps(): number {
    return this.stepCount;
  }

  start(scheduler: (callback: (timeMs: number) => void) => number = requestAnimationFrame): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.previousTimeMs = 0;
    this.accumulator = 0;

    const tick = (nowMs: number) => {
      if (!this.isRunning) return;
      this.step(nowMs);
      if (this.isRunning) {
        this.frameId = scheduler(tick);
      }
    };

    this.frameId = scheduler(tick);
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.previousTimeMs = 0; // Reset previous time to avoid accumulator jump after pause
  }

  stop(canceller: (id: number) => void = cancelAnimationFrame): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.frameId !== null) {
      canceller(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * Deterministic step method, directly callable in tests or by frame scheduler.
   */
  step(nowMs: number): void {
    if (!this.isRunning) return;

    if (this.previousTimeMs === 0) {
      this.previousTimeMs = nowMs;
      this.callbacks.onRender(nowMs);
      return;
    }

    const rawDeltaSeconds = (nowMs - this.previousTimeMs) / 1000;
    this.previousTimeMs = nowMs;

    if (this.isPaused) {
      this.callbacks.onRender(nowMs);
      return;
    }

    // Clamp delta to prevent spiral of death or huge jumps after background suspension
    const clampedDelta = Math.min(rawDeltaSeconds, this.maxFrameDeltaSeconds);
    this.accumulator += clampedDelta;

    let steps = 0;
    while (this.accumulator >= this.fixedStepSeconds && steps < this.maxCatchUpSteps) {
      this.callbacks.onFixedUpdate(this.fixedStepSeconds);
      this.accumulator -= this.fixedStepSeconds;
      steps++;
      this.stepCount++;
    }

    // Drop excess accumulated time if max catch up steps reached
    if (this.accumulator > this.fixedStepSeconds * this.maxCatchUpSteps) {
      this.accumulator = 0;
    }

    this.callbacks.onRender(nowMs);
  }
}
