export type TileId = number;

export interface TileLayer {
  readonly id: string;
  readonly name: string;
  readonly data: readonly TileId[];
  readonly visible: boolean;
  readonly opacity: number;
}

export interface MapDefinition {
  readonly id: string;
  readonly name: string;
  readonly widthInTiles: number;
  readonly heightInTiles: number;
  readonly tileSize: number; // in world pixels, e.g. 32
  readonly layers: readonly TileLayer[];
  readonly spawnPoint: {
    readonly x: number;
    readonly y: number;
  };
}
