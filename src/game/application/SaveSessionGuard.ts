import { SaveRepository, SaveSnapshot } from '../domain/repositories/SaveRepository';

export interface SaveSessionResult {
  readonly ok: boolean;
  readonly error?: string;
}

type SnapshotRepository = Pick<SaveRepository, 'loadSnapshot' | 'saveSnapshot'>;

/**
 * Prevents a failed save validation from being silently overwritten by the
 * next background or manual save. A fresh session must load successfully
 * before any snapshot is written for that slot.
 */
export class SaveSessionGuard {
  private loadFailed = false;

  constructor(
    private readonly repository: SnapshotRepository,
    private readonly slotId: string
  ) {}

  get isSaveBlocked(): boolean {
    return this.loadFailed;
  }

  async load(applySnapshot: (snapshot: SaveSnapshot) => void): Promise<SaveSessionResult> {
    try {
      const snapshot = await this.repository.loadSnapshot(this.slotId);
      if (snapshot) applySnapshot(snapshot);
      this.loadFailed = false;
      return { ok: true };
    } catch (err) {
      this.loadFailed = true;
      return { ok: false, error: describeError(err) };
    }
  }

  async save(createSnapshot: () => SaveSnapshot): Promise<SaveSessionResult> {
    if (this.loadFailed) {
      return { ok: false, error: 'Save blocked: existing save failed validation' };
    }

    try {
      await this.repository.saveSnapshot(this.slotId, createSnapshot());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: describeError(err) };
    }
  }

  /** Explicit user action after a corrupt save is deleted. */
  allowNewGame(): void {
    this.loadFailed = false;
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
