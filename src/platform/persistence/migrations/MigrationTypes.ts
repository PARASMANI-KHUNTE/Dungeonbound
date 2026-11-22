import { DatabaseConnection } from '../DatabaseConnection';

export interface Migration {
  readonly version: number;
  readonly name: string;
  up(db: DatabaseConnection): Promise<void>;
}
