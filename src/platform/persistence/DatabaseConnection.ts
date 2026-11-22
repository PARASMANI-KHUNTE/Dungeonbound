export interface RunResult {
  readonly changes: number;
  readonly lastInsertRowId: number;
}

export interface DatabaseConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<RunResult>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  withTransactionAsync<T>(action: () => Promise<T>): Promise<T>;
}
