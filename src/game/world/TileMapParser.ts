import { MapDefinition, TileLayer } from './MapDefinition';

export interface RawTiledMapData {
  id?: string;
  name?: string;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: Array<{
    id?: number | string;
    name: string;
    data: number[];
    visible?: boolean;
    opacity?: number;
  }>;
  spawnPoint?: { x: number; y: number };
}

export function parseTileMap(raw: RawTiledMapData, defaultId = 'test_map'): MapDefinition {
  if (!raw.width || raw.width <= 0 || !raw.height || raw.height <= 0) {
    throw new Error(`Invalid map dimensions: ${raw.width}x${raw.height}`);
  }
  if (!raw.tilewidth || raw.tilewidth <= 0) {
    throw new Error(`Invalid tilewidth: ${raw.tilewidth}`);
  }
  if (!Array.isArray(raw.layers) || raw.layers.length === 0) {
    throw new Error('Map must contain at least one layer');
  }

  const expectedLength = raw.width * raw.height;
  const layers: TileLayer[] = raw.layers.map((layer, index) => {
    if (!Array.isArray(layer.data) || layer.data.length !== expectedLength) {
      throw new Error(
        `Layer '${layer.name}' data length (${layer.data?.length}) does not match map dimensions (${expectedLength})`
      );
    }
    return Object.freeze({
      id: String(layer.id ?? `layer_${index}`),
      name: layer.name,
      data: Object.freeze([...layer.data]),
      visible: layer.visible !== false,
      opacity: typeof layer.opacity === 'number' ? layer.opacity : 1.0,
    });
  });

  const defaultSpawn = {
    x: Math.floor(raw.width / 2) * raw.tilewidth,
    y: Math.floor(raw.height / 2) * raw.tilewidth,
  };

  return Object.freeze({
    id: raw.id ?? defaultId,
    name: raw.name ?? defaultId,
    widthInTiles: raw.width,
    heightInTiles: raw.height,
    tileSize: raw.tilewidth,
    layers: Object.freeze(layers),
    spawnPoint: Object.freeze(raw.spawnPoint ?? defaultSpawn),
  });
}
