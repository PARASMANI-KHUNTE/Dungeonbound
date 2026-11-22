import { Vector2, createVector2 } from '../game/domain/value-objects/Vector2';

export interface InputSnapshot {
  readonly moveVector: Vector2;
  readonly isInteracting: boolean;
  readonly isAttacking: boolean;
  readonly isDodging: boolean;
}

export class TouchInputAdapter {
  private _moveVector: Vector2 = createVector2(0, 0);
  private _isInteracting = false;
  private _isAttacking = false;
  private _isDodging = false;

  setMovement(x: number, y: number): void {
    this._moveVector = createVector2(x, y);
  }

  setInteracting(value: boolean): void {
    this._isInteracting = value;
  }

  setAttacking(value: boolean): void {
    this._isAttacking = value;
  }

  setDodging(value: boolean): void {
    this._isDodging = value;
  }

  reset(): void {
    this._moveVector = createVector2(0, 0);
    this._isInteracting = false;
    this._isAttacking = false;
    this._isDodging = false;
  }

  readSnapshot(): InputSnapshot {
    return {
      moveVector: this._moveVector,
      isInteracting: this._isInteracting,
      isAttacking: this._isAttacking,
      isDodging: this._isDodging,
    };
  }
}
